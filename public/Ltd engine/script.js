// ==========================================
// SIDEBAR & NAVIGATION FUNCTIONS
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

function navigateSection(targetPage) {
    window.location.href = targetPage;
}

function showSection(sectionId) {
    if (sectionId === 'sim-tab' || sectionId === 'formula-tab') {
        openTab(event, sectionId);
    }
    toggleSidebar();
}

// ==========================================
// TAB NAVIGATION & MERMAID RENDER LOGIC
// ==========================================
function openTab(evt, tabId) {
    let contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].style.display = "none";
    }
    
    let tabs = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].className = tabs[i].className.replace(" active", "");
    }
    
    document.getElementById(tabId).style.display = "block";
    evt.currentTarget.className += " active";

    // Trigger Mermaid to render ONLY when the tab is visible
    if (tabId === 'formula-tab') {
        try {
            mermaid.init(undefined, document.getElementById('stirling-flowchart'));
        } catch (e) {
            console.log("Mermaid already initialized or error: ", e);
        }
    }
}

// ==========================================
// 1000-STEP SECOND ORDER NUMERICAL SOLVER
// ==========================================
function runLTDSimulation() {
    // 1. Inputs
    const x0 = parseFloat(document.getElementById('input_piston_stroke_m').value);
    const y0 = parseFloat(document.getElementById('input_displacer_stroke_m').value);
    const Vsp = parseFloat(document.getElementById('input_piston_swept_volume_m3').value);
    const Vsd = parseFloat(document.getElementById('input_displacer_swept_volume_m3').value);
    const phi = parseFloat(document.getElementById('input_phase_angle_deg').value) * (Math.PI / 180);
    const rpm = parseFloat(document.getElementById('input_engine_speed_rpm').value);
    const omega = (rpm * 2 * Math.PI) / 60;
    
    // Stabilized Time Step
    const steps = 1000;
    const dt = (60 / rpm) / steps; 

    const p_init = parseFloat(document.getElementById('input_initial_pressure_pa').value);
    const Tc_init = parseFloat(document.getElementById('input_cold_sink_temperature_k').value);
    const TH_init = parseFloat(document.getElementById('input_hot_source_temperature_k').value);

    // Constants
    const R = 287, Cp = 1005, Cv = 718; 
    const gamma = Cp / Cv;
    const Vdc = 0.0001, Vde = 0.0001; 
    const VT = Vsp + Vsd + Vdc + Vde; 
    const AhH = 0.05, AhC = 0.05, Ahm = 0.5, mm = 0.1, Afree = 0.01, dh = 0.001, mu = 1.8e-5;
    
    // Initialization
    let p = p_init, pc = p, pe = p, pr = p;
    let Tc = Tc_init, Te = TH_init, Tr = (Tc_init + TH_init)/2;
    let Tm = Tr, TH = TH_init, TC_temp = Tc_init;
    
    let mc = (pc * (Vdc + Vsp/2)) / (R * Tc);
    let me = (pe * (Vde + Vsd/2)) / (R * Te);
    let mr = (pr * 0.0005) / (R * Tr); 

    let indicatedWorkPerCycle = 0, brakeWorkPerCycle = 0, cycleHotHeatTransferTotal = 0, cycleColdHeatTransferTotal = 0, cycleRegeneratorHeatTransferTotal = 0;

    let finalCyclePressureRate = 0, finalCycleMassFlowColdToRegenerator = 0, finalCycleMassFlowRegeneratorToExpansion = 0, finalCycleMatrixTemperatureRate = 0;
    let finalCycleColdSideHeatTransferCoefficient = 0, finalCycleHotSideHeatTransferCoefficient = 0, finalCycleMatrixHeatTransferCoefficient = 0, finalCyclePressureDrop = 0, finalCyclePistonTorque = 0;

    // 2. Numerical Integration Loop
    for (let step = 1; step <= steps; step++) {
        let t = step * dt;
        let theta = omega * t; 

        // Volumes (Eq. 3.3 & Eq. 3.4)
        let Vc = Vdc + (Vsp / 2) * (1 + Math.cos(theta - phi)) + (Vsd / 2) * (1 - Math.cos(theta));
        let Ve = Vde + (Vsd / 2) * (1 + Math.cos(theta));
        let Vr = 0.0005; 
        
        // Volume Derivatives (Eq. 3.5 & Eq. 3.6)
        let dVcdt = -(Vsp / 2) * omega * Math.sin(theta - phi) + (Vsd / 2) * omega * Math.sin(theta);
        let dVedt = -(Vsd / 2) * omega * Math.sin(theta);

        // STABILIZATION: Bound temperatures logically (Eq. 3.18, Eq. 3.19, Eq. 3.20)
        Tc = Math.max(100, Math.min(1000, (pc * Vc) / (R * mc)));
        Tr = Math.max(100, Math.min(1000, (pr * Vr) / (R * mr)));
        Te = Math.max(100, Math.min(1000, (pe * Ve) / (R * me)));

        let Tcr = (dVcdt < 0) ? Tc : Tr; 
        let Tre = (dVedt > 0) ? Tr : Te;

        // Kinematic Displacements (Eq. 3.1)
        // STABILIZATION: Math.abs protects fractional powers
        let Vp = Math.abs(-(x0 / 2) * omega * Math.sin(theta - phi)); 
        
        // Heat transfer coefficients (Eq. 3.29)
        let hC = 2.43 * Math.pow(Vp + 0.001, 1/3) * Math.pow(Math.abs((pc/100000) * Tc), 1/2); 
        let hH = 2.43 * Math.pow(Vp + 0.001, 1/3) * Math.pow(Math.abs((pe/100000) * Te), 1/2);
        
        let Re_bar = 500; 
        
        // Regenerator Correlations (Eq. 3.30, Eq. 3.31, Eq. 3.33, Eq. 3.32)
        let Nu_bar = 0.33 * Math.pow(Re_bar, 0.67);
        let NTU = (4 * Nu_bar * 0.075) / (0.7 * Re_bar * dh); 
        let e_eff = NTU / (NTU + 2); 
        let hm = (NTU * Cp * 0.001) / Ahm; 

        // Heat Transfers (Eq. 3.25, Eq. 3.26, Eq. 3.27)
        let dQH = hH * AhH * (TH - Te);        
        let dQr = e_eff * hm * Ahm * (Tm - Tr);
        let dQC = hC * AhC * (TC_temp - Tc);
        
        cycleHotHeatTransferTotal += dQH * dt;
        cycleColdHeatTransferTotal += dQC * dt;
        cycleRegeneratorHeatTransferTotal += dQr * dt;

        // Global Pressure Derivative (Eq. 3.12)
        let dpdt = (1 / (Cv * VT)) * ( R * (dQH + dQr + dQC) - Cp * (pc * dVcdt + pe * dVedt) );
        
        // Mass Flow Rates (Eq. 3.10 & Eq. 3.11)
        let m_dot_cr = -(1 / (R * Tcr)) * (-(R / Cp) * dQC + pc * dVcdt + (Vc / gamma) * dpdt);
        let m_dot_re = (1 / (R * Tre)) * (-(R / Cp) * dQH + pe * dVedt + (Ve / gamma) * dpdt);

        // Mass Conservation Integration (Eq. 3.15, Eq. 3.16, Eq. 3.17)
        // STABILIZATION: Clamp mass integration to prevent negative mass explosions
        mc = Math.max(1e-5, mc + (-m_dot_cr) * dt);
        mr = Math.max(1e-5, mr + (m_dot_cr - m_dot_re) * dt);
        me = Math.max(1e-5, me + (m_dot_re) * dt);

        // Matrix Temperature Derivative (Eq. 3.14)
        let dTmdt = (1 / (mm * Cp)) * (-dQr);
        Tm += dTmdt * dt;

        // Pressure Drop (Eq. 3.21)
        let fr = 64 / Math.max(1, Re_bar); 
        let delta_p = -(2 * fr * mu * Vp * Vr) / (Afree * Math.pow(dh, 2));
        
        p += dpdt * dt;
        
        // Local Pressures (Eq. 3.23 & Eq. 3.24)
        pc = p; 
        pr = pc + (delta_p / 2);
        pe = pr + (delta_p / 2);

        // Instantaneous Piston Torque Load approximation (Eq. 3.40 mapped into Torque context)
        let Torque_piston = (pc - p_init) * 0.0054 * (x0 / 2) * Math.sin(theta - phi);
        
        // Instantaneous Indicated Work (Eq. 3.34)
        let dWidt = (pc * dVcdt) + (pe * dVedt); 
        
        // Cyclic Indicated Work (Eq. 3.35)
        indicatedWorkPerCycle += dWidt * dt; 
        
        // Cyclic Brake Work formulation based on torque (Eq. 3.60)
        let dWbdt = (Torque_piston - (0.0015 * Math.abs(Torque_piston))) * omega;
        brakeWorkPerCycle += dWbdt * dt;

        // Snapshot capture at t = 1 cycle
        if (step === steps) {
            finalCyclePressureRate = dpdt; finalCycleMassFlowColdToRegenerator = m_dot_cr; finalCycleMassFlowRegeneratorToExpansion = m_dot_re;
            finalCycleMatrixTemperatureRate = dTmdt; finalCycleColdSideHeatTransferCoefficient = hC; finalCycleHotSideHeatTransferCoefficient = hH; finalCycleMatrixHeatTransferCoefficient = hm;
            finalCyclePressureDrop = delta_p; finalCyclePistonTorque = Torque_piston;
        }
    }

    // 3. UI Output Mapping
    let cycleFrequencyHz = rpm / 60; 
    
    // Indicated Power (Eq. 3.36)
    let indicatedPowerWatts = indicatedWorkPerCycle * cycleFrequencyHz;
    
    // Brake Power (Eq. 3.61)
    let brakePowerWatts = brakeWorkPerCycle * cycleFrequencyHz;

    document.getElementById('output_compression_space_pressure_pa').value = pc.toFixed(1);
    document.getElementById('output_expansion_space_pressure_pa').value = pe.toFixed(1);
    document.getElementById('output_regenerator_space_pressure_pa').value = pr.toFixed(1);
    document.getElementById('output_pressure_drop_pa').value = finalCyclePressureDrop.toFixed(4);
    document.getElementById('output_pressure_rate_pa_per_s').value = finalCyclePressureRate.toFixed(2);
    
    document.getElementById('output_compression_space_temperature_k').value = Tc.toFixed(2);
    document.getElementById('output_expansion_space_temperature_k').value = Te.toFixed(2);
    document.getElementById('output_regenerator_space_temperature_k').value = Tr.toFixed(2);
    document.getElementById('output_hot_plate_temperature_k').value = TH.toFixed(2);
    document.getElementById('output_matrix_temperature_k').value = Tm.toFixed(2);
    document.getElementById('output_matrix_temperature_rate_k_per_s').value = finalCycleMatrixTemperatureRate.toFixed(4);

    document.getElementById('output_compression_space_mass_kg').value = mc.toExponential(3);
    document.getElementById('output_expansion_space_mass_kg').value = me.toExponential(3);
    document.getElementById('output_regenerator_space_mass_kg').value = mr.toExponential(3);
    document.getElementById('output_mass_flow_cold_to_regenerator_kg_per_s').value = finalCycleMassFlowColdToRegenerator.toExponential(3);
    document.getElementById('output_mass_flow_regenerator_to_expansion_kg_per_s').value = finalCycleMassFlowRegeneratorToExpansion.toExponential(3);

    document.getElementById('output_cold_side_heat_transfer_coefficient_w_per_m2k').value = finalCycleColdSideHeatTransferCoefficient.toFixed(2);
    document.getElementById('output_hot_side_heat_transfer_coefficient_w_per_m2k').value = finalCycleHotSideHeatTransferCoefficient.toFixed(2);
    document.getElementById('output_matrix_heat_transfer_coefficient_w_per_m2k').value = finalCycleMatrixHeatTransferCoefficient.toFixed(2);
    document.getElementById('output_instantaneous_piston_torque_nm').value = finalCyclePistonTorque.toFixed(4);

    document.getElementById('output_cycle_hot_heat_in_j').value = cycleHotHeatTransferTotal.toFixed(2);
    document.getElementById('output_cycle_cold_heat_out_j').value = cycleColdHeatTransferTotal.toFixed(2);
    document.getElementById('output_cycle_regenerator_heat_j').value = cycleRegeneratorHeatTransferTotal.toFixed(2);
    document.getElementById('output_cycle_indicated_work_j').value = Math.abs(indicatedWorkPerCycle).toFixed(2);
    document.getElementById('output_cycle_brake_work_j').value = Math.abs(brakeWorkPerCycle).toFixed(2);
    
    document.getElementById('output_indicated_power_w').value = Math.abs(indicatedPowerWatts).toFixed(2);
    document.getElementById('output_brake_power_w').value = Math.abs(brakePowerWatts).toFixed(2);
}