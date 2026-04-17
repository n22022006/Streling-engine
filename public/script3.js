function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

function navigatePage(targetPage) {
    window.location.href = targetPage;
}

function setButtonLoading(button, loadingLabel) {
    if (!button) {
        return () => {};
    }

    if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.innerHTML;
    }

    const loadingStartTimeMs = performance.now();
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = loadingLabel;

    return () => {
        const elapsedLoadingTimeMs = performance.now() - loadingStartTimeMs;
        const remainingLoadingDelayMs = Math.max(0, 280 - elapsedLoadingTimeMs);
        setTimeout(() => {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = button.dataset.defaultLabel;
        }, remainingLoadingDelayMs);
    };
}

function calculatePower(withUiLoading = true) {
    const calcBtn = withUiLoading
        ? document.querySelector('.calc-btn[onclick*="calculatePower"]')
        : null;
    const finishLoading = setButtonLoading(calcBtn, 'Computing...');

    // PROGRAM: Stirling Power Program
    // Power model used in this program
    // Page 10, Eqs. (24), (26), (28), (29) from the paper
    // Mean average gas pressure (Eq. 26)
    // Pm = rho * R * Tair = 323.49 * Tair
    // Swept volume (Eq. 28)
    // V = pi * r^2 * L
    // Engine cycle frequency
    // F = speed / 60
    // Total power output (Eq. 24 & 29)
    // P = Bn * Pm * V * F

    // 1. Gather Inputs from the UI
    const tair_C = parseFloat(document.getElementById('tair').value);
    const plateRadius_cm = parseFloat(document.getElementById('plateRadius').value);
    const plateLength_cm = parseFloat(document.getElementById('plateLength').value);
    const speed_rpm = parseFloat(document.getElementById('speed').value);
    const beale_no = parseFloat(document.getElementById('beale').value);

    if (
        [tair_C, plateRadius_cm, plateLength_cm, speed_rpm, beale_no].some((v) => !Number.isFinite(v)) ||
        plateRadius_cm <= 0 ||
        plateLength_cm <= 0
    ) {
        document.getElementById('volume').value = '';
        document.getElementById('powerOut').value = '';
        document.getElementById('pressureOut').value = '';
        finishLoading();
        return;
    }

    // Swept volume from geometry: V = pi * r^2 * L (in cm^3 when r and L are in cm)
    const volume_cm3 = Math.PI * Math.pow(plateRadius_cm, 2) * plateLength_cm;
    document.getElementById('volume').value = volume_cm3.toFixed(3);

    // 2. Unit Conversions
    const tair_K = tair_C + 273.15;            // Celsius to Kelvin
    const freq_Hz = speed_rpm / 60;            // RPM to Hertz (Cycles per second)
    const volume_m3 = volume_cm3 * 1e-6;       // Cubic centimeters to cubic meters

    // 3. Equation 26: Mean average gas pressure (Pm)
    // Pm = rho * R * T = 1.127 * 287 * Tair = 323.49 * Tair
    const pressure_Pa = 323.49 * tair_K;
    
    // Convert Pascals to MegaPascals (MPa) for the UI output
    const pressure_MPa = pressure_Pa / 1e6;

    // 4. Equation 24 & 29: Stirling engine power output (P)
    // P = Bn * Pm * V * F
    const power_Watts = beale_no * pressure_Pa * volume_m3 * freq_Hz;

    // 5. Update the UI 
    // Using toFixed(6) to match the 6-decimal precision shown in Fig 20 of the paper
    document.getElementById('powerOut').value = power_Watts.toFixed(6);
    document.getElementById('pressureOut').value = pressure_MPa.toFixed(6);

    finishLoading();
}

// Run the calculation automatically when the page loads
window.onload = function () {
    calculatePower(false);
};