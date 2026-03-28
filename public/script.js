// ==========================================
// FIREBASE INITIALIZATION (v8 Compat mode)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAQmqPdwrYf3Qri8G1FTuHoYRbQeKlg-a0",
    authDomain: "solar-sterling-engine.firebaseapp.com",
    projectId: "solar-sterling-engine",
    storageBucket: "solar-sterling-engine.firebasestorage.app",
    messagingSenderId: "789216255561",
    appId: "1:789216255561:web:5cd3e3c82b3676c0a6e998",
    measurementId: "G-S70ZYWEB9X"
};

// Initialize Firebase using the global variable
try {
    if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        if (typeof firebase.analytics === 'function') {
            firebase.analytics();
        }
        console.log("Firebase Initialized Successfully.");
    }
} catch (error) {
    console.warn("Firebase initialization skipped:", error);
}

// ==========================================
// UI & NAVIGATION LOGIC
// ==========================================

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}

function navigateSection(sectionId) {
    if (sectionId === 'index2.html') {
        window.location.href = 'index2.html';
        return;
    }
    showSection(sectionId);
}

function showSection(sectionId, closeSidebar = true) {
    // Hide all app sections and show selected section
    const sections = document.querySelectorAll('.app-section');
    sections.forEach((section) => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    // Trigger MathJax to re-render equations on theory section
    if (sectionId === 'theory-section' && window.MathJax && typeof MathJax.typesetPromise === 'function') {
        MathJax.typesetPromise();
    }

    if (window.location.hash !== `#${sectionId}`) {
        window.location.hash = sectionId;
    }

    // Close the sidebar automatically when menu item is clicked
    if (closeSidebar) {
        toggleSidebar();
    }
}

// ==========================================
// SOLAR RADIATION MATHEMATICAL ENGINE
// ==========================================

function getDecimal(d, m, s) {
    return parseFloat(d) + (parseFloat(m) / 60) + (parseFloat(s) / 3600);
}

function formatTime(decimalHours) {
    if (isNaN(decimalHours)) return { h: 0, m: 0 };
    let h = Math.floor(decimalHours);
    let rem = (decimalHours - h) * 60;
    let m = Math.round(rem);
    if (h < 0) h += 24;
    if (h >= 24) h -= 24;
    return { h: h, m: m };
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function runSimulation() {
    // Gather Inputs
    const stdLon = getDecimal(document.getElementById('std_lon_d').value, document.getElementById('std_lon_m').value, document.getElementById('std_lon_s').value);
    const locLon = getDecimal(document.getElementById('loc_lon_d').value, document.getElementById('loc_lon_m').value, document.getElementById('loc_lon_s').value);
    const locLat = getDecimal(document.getElementById('loc_lat_d').value, document.getElementById('loc_lat_m').value, document.getElementById('loc_lat_s').value);
    
    const timeH = parseFloat(document.getElementById('time_h').value);
    const timeM = parseFloat(document.getElementById('time_m').value);
    const timeS = parseFloat(document.getElementById('time_s').value);
    const standardTimeDecimal = timeH + (timeM / 60) + (timeS / 3600);

    const day = parseInt(document.getElementById('date_d').value);
    const month = parseInt(document.getElementById('date_m').value);
    
    const tiltDeg = parseFloat(document.getElementById('tilt_angle').value);
    const albedo = parseFloat(document.getElementById('ground_type').value); 
    const direction = document.getElementById('direction').value;

    const lonMultiplier = (direction === "East") ? 1 : -1;
    const locLonAdjusted = locLon * lonMultiplier;
    const stdLonAdjusted = stdLon * lonMultiplier;

    // Time Math
    const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let n = day;
    for (let i = 0; i < month - 1; i++) n += daysInMonths[i];

    const B_eq = (n - 1) * (360 / 365) * (Math.PI / 180);
    const Et = 229.2 * (0.000075 + 0.001868 * Math.cos(B_eq) - 0.032077 * Math.sin(B_eq) - 0.014615 * Math.cos(2 * B_eq) - 0.04089 * Math.sin(2 * B_eq));
    
    const L = locLat * (Math.PI / 180);       
    const beta = tiltDeg * (Math.PI / 180);   

    const decAngle = 23.45 * Math.sin((360 / 365) * (284 + n) * (Math.PI / 180));
    const delta = decAngle * (Math.PI / 180);

    const ws = Math.acos(-Math.tan(L) * Math.tan(delta)); 
    const wsDeg = ws * (180 / Math.PI);
    
    const timeCorrection = (4 * (stdLonAdjusted - locLonAdjusted) + Et) / 60;
    const sunriseSolarHour = 12 - (wsDeg / 15);
    const sunsetSolarHour = 12 + (wsDeg / 15);
    const sunriseStdTime = formatTime(sunriseSolarHour - timeCorrection);
    const sunsetStdTime = formatTime(sunsetSolarHour - timeCorrection);

    document.getElementById('out_sr_h').value = sunriseStdTime.h;
    document.getElementById('out_sr_m').value = sunriseStdTime.m;
    document.getElementById('out_ss_h').value = sunsetStdTime.h;
    document.getElementById('out_ss_m').value = sunsetStdTime.m;

    const A = 1160 + 75 * Math.sin((360 / 365) * (n - 275) * (Math.PI / 180));
    const B_ext = 0.174 + 0.035 * Math.sin((360 / 365) * (n - 100) * (Math.PI / 180));

    const selectedSolarTime = standardTimeDecimal + timeCorrection;
    const selectedHourAngleDeg = 15 * (selectedSolarTime - 12);

    let graph_time = [];
    let graph_radiation = [];
    let daily_total_Wh = 0;
    let specific_total = 0, specific_beam = 0, specific_diffuse = 0, specific_ground = 0;

    for (let hr = 4; hr <= 20; hr += 0.25) {
        const solarTime = hr + timeCorrection;
        const hourAngle = 15 * (solarTime - 12);
        const h = hourAngle * (Math.PI / 180);

        const cosPhi = Math.sin(L) * Math.sin(delta) + Math.cos(L) * Math.cos(delta) * Math.cos(h);
        let Gt = 0, GBt = 0, GDt = 0, GRt = 0;

        if (cosPhi > 0) {
            const GBn = A * Math.exp(-B_ext / cosPhi); 
            const GB = GBn * cosPhi; 

            const numerator = Math.sin(L - beta) * Math.sin(delta) + Math.cos(L - beta) * Math.cos(delta) * Math.cos(h);
            const RB = numerator / cosPhi;

            GBt = GB * Math.max(RB, 0); 

            const RD = (1 + Math.cos(beta)) / 2;
            GDt = (0.11 * GBn) * RD;

            const GD = 0.11 * GBn;
            const RR = albedo * ((1 - Math.cos(beta)) / 2); 
            GRt = (GB + GD) * RR;

            Gt = GBt + GDt + GRt;
            daily_total_Wh += (Gt * 0.25);
        }

        graph_time.push(hr);
        graph_radiation.push(Gt > 0 ? Gt : 0);

        if (Math.abs(hr - standardTimeDecimal) < 0.15) {
            specific_beam = GBt;
            specific_diffuse = GDt;
            specific_ground = GRt;
            specific_total = Gt;
        }
    }

    document.getElementById('out_total_time').value = specific_total.toFixed(2);
    document.getElementById('out_beam').value = specific_beam.toFixed(2);
    document.getElementById('out_diffuse').value = specific_diffuse.toFixed(2);
    document.getElementById('out_ground').value = specific_ground.toFixed(2);
    document.getElementById('out_total_day').value = (daily_total_Wh / 1000).toFixed(4);

    const peakRadiation = graph_radiation.length ? Math.max(...graph_radiation) : 0;

    setText('ex_day_number', n);
    setText('ex_et', Et.toFixed(2));
    setText('ex_time_correction', timeCorrection.toFixed(3));
    setText('ex_selected_time', standardTimeDecimal.toFixed(2));
    setText('ex_selected_solar_time', selectedSolarTime.toFixed(2));
    setText('ex_hour_angle', selectedHourAngleDeg.toFixed(2));
    setText('ex_beam', specific_beam.toFixed(2));
    setText('ex_diffuse', specific_diffuse.toFixed(2));
    setText('ex_ground', specific_ground.toFixed(2));
    setText('ex_total', specific_total.toFixed(2));
    setText('ex_point_count', graph_time.length);
    setText('ex_peak_radiation', peakRadiation.toFixed(2));

    const trace = {
        x: graph_time, 
        y: graph_radiation, 
        type: 'scatter', 
        mode: 'lines',
        line: { color: '#e53e3e', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(229, 62, 62, 0.1)'
    };
    
    const layout = {
        title: { text: 'Total Solar Radiation vs Day Time', font: { color: '#1a365d', size: 18 } },
        xaxis: { title: 'Standard Time (Hours)', tickvals: [6, 8, 10, 12, 14, 16, 18] },
        yaxis: { title: 'Gt (W/m²)' },
        margin: { t: 50, b: 50, l: 60, r: 20 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };
    
    if (window.Plotly && typeof Plotly.newPlot === 'function') {
        Plotly.newPlot('radiationChart', [trace], layout, { responsive: true });
    } else {
        console.warn('Plotly failed to load. Skipping chart render.');
    }
}

// Run on page load
window.onload = function () {
    runSimulation();

    const hashSection = window.location.hash.replace('#', '');
    if (hashSection === 'theory-section' || hashSection === 'simulation-section') {
        showSection(hashSection, false);
    }
};