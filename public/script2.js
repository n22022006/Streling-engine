// Helper function to safely evaluate fractional powers with negative bases
function safePow(base, exp) {
    return Math.sign(base) * Math.pow(Math.abs(base), exp);
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}

function navigatePage(targetPage) {
    window.location.href = targetPage;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function calculateTemperatures() {
    // 1. Gather Inputs
    const Ta1_C = parseFloat(document.getElementById('Ta1').value);
    const Ta2_C = parseFloat(document.getElementById('Ta2').value);
    const Gt = parseFloat(document.getElementById('Gt').value);

    // Convert to Kelvin for Radiation (T^4)
    const Ta1 = Ta1_C + 273.15;
    const Ta2 = Ta2_C + 273.15;

    // Initial Guesses (Starting near typical operating conditions)
    let Tp1 = Ta1 + 15; 
    let Tp2 = Ta2 + 5;
    
    // Use a smaller learning rate and more iterations for stability
    const learningRate = 0.002;
    const iterations = 5000;

    // 2. Numerical Iteration to solve Eqs. 22 and 23 from the paper
    for (let i = 0; i < iterations; i++) {
        
        // Eq 24 (Simplified): Tair is the average of the two plates
        let Tair = (Tp1 + Tp2) / 2;

        // Equation 22 Residual (Energy balance on Plate 1)
        // Corrected the ambient radiation term to properly use Tp1, not Tp2
        let left22 = 0.95 * Gt 
                   + 0.895055 * safePow((Ta1 - Tp1), 1.33) 
                   + 5.669e-8 * (Math.pow(Ta1, 4) - Math.pow(Tp1, 4)); 
                   
        let right22 = 28.0346 * safePow((Tp1 - Tair), 1.25) 
                    + 5.068e-8 * (Math.pow(Tp1, 4) - Math.pow(Tp2, 4));
        
        let error1 = left22 - right22;

        // Equation 23 Residual (Energy balance on Plate 2)
        let left23 = 28.0346 * safePow((Tair - Tp2), 1.25) 
                   + 4.9e-8 * (Math.pow(Tp1, 4) - Math.pow(Tp2, 4));
                   
        let right23 = 0.903129 * safePow((Tp2 - Ta2), 1.33) 
                    + 4.36e-8 * (Math.pow(Tp2, 4) - Math.pow(Ta2, 4));
                    
        let error2 = left23 - right23;

        // Calculate updates
        let update1 = error1 * learningRate;
        let update2 = error2 * learningRate;

        // CLAMP THE UPDATES: Prevent the T^4 radiation terms from blowing up the iteration
        // Limits the temperature change to a maximum of 1 degree per loop
        Tp1 += Math.max(-1, Math.min(1, update1));
        Tp2 += Math.max(-1, Math.min(1, update2));
    }

    // Recalculate final Air Temperature
    let Tair_final = (Tp1 + Tp2) / 2;

    // Convert back to Celsius
    const Tp1_C = Tp1 - 273.15;
    const Tp2_C = Tp2 - 273.15;
    const Tair_C = Tair_final - 273.15;

    // 3. Update the UI
    document.getElementById('Tp1').value = Tp1_C.toFixed(1);
    document.getElementById('Tp2').value = Tp2_C.toFixed(1);
    document.getElementById('Tair').value = Tair_C.toFixed(6);

    // 4. Show how formulas produce the output
    const eq22_lhs = 0.95 * Gt
        + 0.895055 * safePow((Ta1 - Tp1), 1.33)
        + 5.669e-8 * (Math.pow(Ta1, 4) - Math.pow(Tp1, 4));

    const eq22_rhs = 28.0346 * safePow((Tp1 - Tair_final), 1.25)
        + 5.068e-8 * (Math.pow(Tp1, 4) - Math.pow(Tp2, 4));

    const eq23_lhs = 28.0346 * safePow((Tair_final - Tp2), 1.25)
        + 4.9e-8 * (Math.pow(Tp1, 4) - Math.pow(Tp2, 4));

    const eq23_rhs = 0.903129 * safePow((Tp2 - Ta2), 1.33)
        + 4.36e-8 * (Math.pow(Tp2, 4) - Math.pow(Ta2, 4));

    setText('ex_ta1_c', Ta1_C.toFixed(2));
    setText('ex_ta1_k', Ta1.toFixed(2));
    setText('ex_ta2_c', Ta2_C.toFixed(2));
    setText('ex_ta2_k', Ta2.toFixed(2));
    setText('ex_gt', Gt.toFixed(2));
    setText('ex_iterations', iterations);
    setText('ex_lr', learningRate.toFixed(3));

    setText('ex_eq22_lhs', eq22_lhs.toFixed(6));
    setText('ex_eq22_rhs', eq22_rhs.toFixed(6));
    setText('ex_eq22_err', (eq22_lhs - eq22_rhs).toExponential(3));

    setText('ex_eq23_lhs', eq23_lhs.toFixed(6));
    setText('ex_eq23_rhs', eq23_rhs.toFixed(6));
    setText('ex_eq23_err', (eq23_lhs - eq23_rhs).toExponential(3));

    setText('ex_tp1_k', Tp1.toFixed(4));
    setText('ex_tp2_k', Tp2.toFixed(4));
    setText('ex_tair_k', Tair_final.toFixed(4));

    setText('ex_tp1_c', Tp1_C.toFixed(2));
    setText('ex_tp2_c', Tp2_C.toFixed(2));
    setText('ex_tair_c', Tair_C.toFixed(4));
}

// Run calculation on load
window.onload = function () {
    calculateTemperatures();
};