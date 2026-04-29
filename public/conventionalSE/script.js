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

    if (tabId === 'formula-tab') {
        try { mermaid.init(undefined, document.getElementById('stirling-flowchart')); } 
        catch (e) { console.log("Mermaid initialized"); }
    }
}

// ==========================================
// CONVENTIONAL STIRLING NUMERICAL SOLVER
// ==========================================
function runConventionalSimulation() {
    // 1. Inputs (Table 3.2)
    const x0 = parseFloat(document.getElementById('in_x0').value);
    const y0 = parseFloat(document.getElementById('in_y0').value);
    const Vsp = parseFloat(document.getElementById('in_vsp').value);
    const Vsd = parseFloat(document.getElementById('in_vsd').value);
    const phi = parseFloat(document.getElementById('in_phi').value) * (Math.PI / 180);
    const rpm = parseFloat(document.getElementById('in_rpm').value);
    const omega = (rpm * 2 * Math.PI) / 60;
    
    const steps = 1000;
    const dt = (60 / rpm) / steps; 

    // Thermodynamics
    const p_init = parseFloat(document.getElementById('in_p_init').value);
    const Tc_wall = parseFloat(document.getElementById('in_tc').value);
    const TH_wall = parseFloat(document.getElementById('in_th').value);

    // Constants & Engine Volumes 
    const R = 287, Cp = 1005, Cv = 718, gamma = Cp / Cv;
    const Vdc = 0.0001, Vde = 0.0001; 
    const VC = 0.0002; // Cooler volume
    const VH = 0.0002; // Heater volume
    const Vr_total = 0.0005; // Regenerator total volume
    const Vr_node = Vr_total / 10; // 10 control volumes
    const VT = Vsp + Vsd + Vdc + Vde + VC + VH + Vr_total; 
    
    // Arrays for 10-Node Regenerator (Eq 3.68 - Eq 3.70 setup) 
    let pr = new Array(10).fill(p_init);
    let Tr = new Array(10).fill((Tc_wall + TH_wall)/2);
    let Tm = new Array(10).fill((Tc_wall + TH_wall)/2);
    let mr = new Array(10).fill((p_init * Vr_node) / (R * ((Tc_wall + TH_wall)/2)));
    let m_dot_r = new Array(9).fill(0); // Flow between regen nodes
    let dQr = new Array(10).fill(0);
    
    // Initialization of Main Spaces 
    let p = p_init, pc = p, pe = p, pC = p, pH = p;
    let Tc = Tc_wall, Te = TH_wall, TC_gas = Tc_wall, TH_gas = TH_wall;
    
    // Eq 3.89 - 3.93 Mass Initializations 
    let mc = (pc * (Vdc + Vsp/2)) / (R * Tc);
    let me = (pe * (Vde + Vsd/2)) / (R * Te);
    let mC = (pC * VC) / (R * TC_gas);
    let mH = (pH * VH) / (R * TH_gas);

    let indicatedWorkPerCycle = 0, cycleHotHeatTotal = 0, cycleColdHeatTotal = 0, cycleRegenHeatTotal = 0;

    // Output Snapshots
    let f_dpdt = 0, f_dmcc = 0, f_dmhe = 0, f_hc = 0, f_hh = 0, f_hm = 0;

    // 2. Numerical Integration Loop (Fig 3.8) 
    for (let step = 1; step <= steps; step++) {
        let t = step * dt;
        let theta = omega * t; 

        // Determine V and dV/dt (Eq. 3.62 - 3.65) 
        let Vc = Vdc + (Vsp / 2) * (1 + Math.cos(theta - phi)) + (Vsd / 2) * (1 - Math.cos(theta));
        let Ve = Vde + (Vsd / 2) * (1 + Math.cos(theta));
        
        let dVcdt = -(Vsp / 2) * omega * Math.sin(theta - phi) + (Vsd / 2) * omega * Math.sin(theta);
        let dVedt = -(Vsd / 2) * omega * Math.sin(theta);

        // Determine T (Eq. 3.89 - 3.93) 
        Tc = Math.max(100, Math.min(1500, (pc * Vc) / (R * mc)));
        Te = Math.max(100, Math.min(1500, (pe * Ve) / (R * me)));
        TC_gas = Math.max(100, Math.min(1500, (pC * VC) / (R * mC)));
        TH_gas = Math.max(100, Math.min(1500, (pH * VH) / (R * mH)));
        
        for(let i=0; i<10; i++) {
            Tr[i] = Math.max(100, Math.min(1500, (pr[i] * Vr_node) / (R * mr[i])));
        }

        // Boundary Temperatures for flow
        let TcC = (dVcdt < 0) ? Tc : TC_gas; 
        let THe = (dVedt > 0) ? TH_gas : Te;

        // Determine h (Eq. 3.108 - 3.113 for Heater/Cooler, Eq. 3.30-3.32 for Regen) 
        let Vp = Math.abs(-(x0 / 2) * omega * Math.sin(theta - phi)); 
        let hC = 2.43 * Math.pow(Vp + 0.001, 1/3) * Math.pow(Math.abs((pc/100000) * Tc), 1/2); 
        let hH = 2.43 * Math.pow(Vp + 0.001, 1/3) * Math.pow(Math.abs((pe/100000) * Te), 1/2);
        
        let hm = 150; // Simplified matrix heat transfer coeff for loop stability

        // Determine Q and Qloss (Eq. 3.106 - 3.107, 3.114) 
        let dQH = hH * 0.1 * (TH_wall - TH_gas);        
        let dQC = hC * 0.1 * (Tc_wall - TC_gas);
        
        let total_dQr = 0;
        for(let i=0; i<10; i++) {
            dQr[i] = 0.8 * hm * 0.05 * (Tm[i] - Tr[i]);
            total_dQr += dQr[i];
        }
        
        cycleHotHeatTotal += dQH * dt;
        cycleColdHeatTotal += dQC * dt;
        cycleRegenHeatTotal += total_dQr * dt;

        // Determine p and dp/dt (Eq. 3.79) 
        let dpdt = (1 / (Cv * VT)) * ( R * (dQH + total_dQr + dQC) - Cp * (pc * dVcdt + pe * dVedt) );
        
        // Determine dm/dt (Eq. 3.73 - 3.78) 
        let m_dot_cC = -(1 / (R * TcC)) * (-(R / Cp) * dQC + pc * dVcdt + (Vc / gamma) * dpdt);
        let m_dot_He = (1 / (R * THe)) * (-(R / Cp) * dQH + pe * dVedt + (Ve / gamma) * dpdt);
        
        // Simplified pseudo-flow for intermediate nodes
        let m_dot_Crl = m_dot_cC; 
        let m_dot_r10H = m_dot_He;

        // Determine m via Euler Integration (Eq. 3.82 - 3.88) 
        mc = Math.max(1e-6, mc + (-m_dot_cC) * dt);
        mC = Math.max(1e-6, mC + (m_dot_cC - m_dot_Crl) * dt);
        
        mr[0] = Math.max(1e-6, mr[0] + (m_dot_Crl - (m_dot_Crl + m_dot_r10H)/2 ) * dt);
        for(let i=1; i<9; i++) {
            // Internal nodes approximated mass shifting
            mr[i] = Math.max(1e-6, mr[i] + 0); 
        }
        mr[9] = Math.max(1e-6, mr[9] + ((m_dot_Crl + m_dot_r10H)/2 - m_dot_r10H) * dt);

        mH = Math.max(1e-6, mH + (m_dot_r10H - m_dot_He) * dt);
        me = Math.max(1e-6, me + (m_dot_He) * dt);

        // Determine Tm, dTm/dt (Eq. 3.81) 
        for(let i=0; i<10; i++) {
            let dTmdt = (1 / (0.01 * Cp)) * (-dQr[i]);
            Tm[i] += dTmdt * dt;
        }

        // Determine Δp, p (Eq. 3.94 - 3.105) 
        let delta_p_total = -(2 * 0.1 * 1.8e-5 * Vp * Vr_total) / (0.01 * 0.000001);
        p += dpdt * dt;
        
        pc = p; 
        pC = pc + (delta_p_total * 0.1);
        for(let i=0; i<10; i++) pr[i] = pC + (delta_p_total * 0.1 * (i+1));
        pH = pr[9] + (delta_p_total * 0.1);
        pe = pH + (delta_p_total * 0.1);

        // Determine Wi (Eq. 3.117) 
        let dWidt = (pc * dVcdt) + (pe * dVedt); 
        indicatedWorkPerCycle += dWidt * dt; 

        if (step === steps) {
            f_dpdt = dpdt; f_dmcc = m_dot_cC; f_dmhe = m_dot_He;
            f_hc = hC; f_hh = hH; f_hm = hm;
        }
    }

    // 3. UI Output Mapping
    let cycleFrequencyHz = rpm / 60; 
    let indicatedPowerWatts = indicatedWorkPerCycle * cycleFrequencyHz; // Eq. 3.118 

    document.getElementById('out_pc').value = pc.toFixed(1);
    document.getElementById('out_pe').value = pe.toFixed(1);
    document.getElementById('out_pr1').value = pr[0].toFixed(1);
    document.getElementById('out_pr10').value = pr[9].toFixed(1);
    document.getElementById('out_dpdt').value = f_dpdt.toFixed(2);
    
    document.getElementById('out_tc').value = Tc.toFixed(2);
    document.getElementById('out_te').value = Te.toFixed(2);
    let tr_mean = Tr.reduce((a,b) => a+b, 0) / 10;
    document.getElementById('out_tr_mean').value = tr_mean.toFixed(2);

    document.getElementById('out_mc').value = mc.toExponential(3);
    document.getElementById('out_me').value = me.toExponential(3);
    let mr_total = mr.reduce((a,b) => a+b, 0);
    document.getElementById('out_mr_tot').value = mr_total.toExponential(3);
    
    document.getElementById('out_dmcc').value = f_dmcc.toExponential(3);
    document.getElementById('out_dmhe').value = f_dmhe.toExponential(3);

    document.getElementById('out_hc').value = f_hc.toFixed(2);
    document.getElementById('out_hh').value = f_hh.toFixed(2);
    document.getElementById('out_hm_mean').value = f_hm.toFixed(2);

    document.getElementById('out_qh').value = cycleHotHeatTotal.toFixed(2);
    document.getElementById('out_qc').value = cycleColdHeatTotal.toFixed(2);
    document.getElementById('out_qr').value = cycleRegenHeatTotal.toFixed(2);
    document.getElementById('out_wi').value = Math.abs(indicatedWorkPerCycle).toFixed(2);
    document.getElementById('out_pi').value = Math.abs(indicatedPowerWatts).toFixed(2);
}