/**
 * BodyMetrics Pro — Motor de Cálculo Antropométrico y Composición Corporal
 */

const state = {
  unit: 'metric', // 'metric' (kg/cm) | 'imperial' (lb/in)
  sex: 'male',    // 'male' | 'female'
  method: 'navy', // 'navy' | 'skinfold' | 'bmi'
  jpMode: 3,      // 3 | 7 pliegues
  historyKey: 'bodymetrics_pro_history_v1',
};

// Factores de conversión
const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

// Referencias del DOM
const els = {
  btnUnitMetric: document.getElementById('btnUnitMetric'),
  btnUnitImperial: document.getElementById('btnUnitImperial'),
  sexMale: document.getElementById('sexMale'),
  sexFemale: document.getElementById('sexFemale'),
  inputAge: document.getElementById('inputAge'),
  inputHeight: document.getElementById('inputHeight'),
  inputWeight: document.getElementById('inputWeight'),
  selectActivity: document.getElementById('selectActivity'),

  // Navy inputs
  inputNeck: document.getElementById('inputNeck'),
  inputWaist: document.getElementById('inputWaist'),
  inputHip: document.getElementById('inputHip'),
  hipInputContainer: document.getElementById('hipInputContainer'),
  waistHelpText: document.getElementById('waistHelpText'),

  // Skinfold inputs
  sfChest: document.getElementById('sfChest'),
  sfTriceps: document.getElementById('sfTriceps'),
  sfAbdomen: document.getElementById('sfAbdomen'),
  sfSuprailiac: document.getElementById('sfSuprailiac'),
  sfThigh: document.getElementById('sfThigh'),
  sfSubscapular: document.getElementById('sfSubscapular'),
  sfAxilla: document.getElementById('sfAxilla'),
  sfCountLabel: document.getElementById('sfCountLabel'),
  sfSumValue: document.getElementById('sfSumValue'),

  // Goal simulator
  inputGoalBf: document.getElementById('inputGoalBf'),
  goalTargetLabel: document.getElementById('goalTargetLabel'),
  goalTargetWeight: document.getElementById('goalTargetWeight'),
  goalFatDelta: document.getElementById('goalFatDelta'),

  // Outputs
  activeMethodBadge: document.getElementById('activeMethodBadge'),
  aceCategoryChip: document.getElementById('aceCategoryChip'),
  bfPercentageValue: document.getElementById('bfPercentageValue'),
  compNavyVal: document.getElementById('compNavyVal'),
  compJpVal: document.getElementById('compJpVal'),
  compBmiVal: document.getElementById('compBmiVal'),
  spectrumPointer: document.getElementById('spectrumPointer'),
  aceSpectrumTicks: document.getElementById('aceSpectrumTicks'),

  barLeanWidth: document.getElementById('barLeanWidth'),
  barFatWidth: document.getElementById('barFatWidth'),
  leanMassLegend: document.getElementById('leanMassLegend'),
  fatMassLegend: document.getElementById('fatMassLegend'),
  fatMassValue: document.getElementById('fatMassValue'),
  essentialFatNote: document.getElementById('essentialFatNote'),
  leanMassValue: document.getElementById('leanMassValue'),
  bmiValue: document.getElementById('bmiValue'),
  bmiCategorySub: document.getElementById('bmiCategorySub'),
  ffmiValue: document.getElementById('ffmiValue'),
  ffmiNormalizedSub: document.getElementById('ffmiNormalizedSub'),

  bmrKatchValue: document.getElementById('bmrKatchValue'),
  tdeeValue: document.getElementById('tdeeValue'),
  tdeeActivityNote: document.getElementById('tdeeActivityNote'),
  calDeficit: document.getElementById('calDeficit'),
  calMaintenance: document.getElementById('calMaintenance'),
  calSurplus: document.getElementById('calSurplus'),

  // History
  historyCount: document.getElementById('historyCount'),
  historyList: document.getElementById('historyList'),
  btnSaveRecord: document.getElementById('btnSaveRecord'),
  btnClearHistory: document.getElementById('btnClearHistory'),
};

/**
 * 1. FÓRMULAS CIENTÍFICAS DE GRASA CORPORAL
 */

// Método Marina de EE. UU. (Hodgdon & Beckett)
function calculateNavyBF(sex, heightCm, neckCm, waistCm, hipCm) {
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null;

  if (sex === 'male') {
    const diff = waistCm - neckCm;
    if (diff <= 0) return null;
    const bf =
      495 /
        (1.0324 -
          0.19077 * Math.log10(diff) +
          0.15456 * Math.log10(heightCm)) -
      450;
    return clampBF(bf);
  } else {
    const sumDiff = waistCm + hipCm - neckCm;
    if (sumDiff <= 0 || hipCm <= 0) return null;
    const bf =
      495 /
        (1.29579 -
          0.35004 * Math.log10(sumDiff) +
          0.22100 * Math.log10(heightCm)) -
      450;
    return clampBF(bf);
  }
}

// Método de Pliegues Cutáneos Jackson-Pollock (3 y 7 sitios) + Ecuación de Siri
function calculateJacksonPollockBF(sex, age, jpMode, folds) {
  let sum = 0;
  let db = 0;

  if (jpMode === 3) {
    if (sex === 'male') {
      sum = folds.chest + folds.abdomen + folds.thigh;
      if (sum <= 0) return { bf: null, sum: 0 };
      db =
        1.10938 -
        0.0008267 * sum +
        0.0000016 * (sum * sum) -
        0.0002574 * age;
    } else {
      sum = folds.triceps + folds.suprailiac + folds.thigh;
      if (sum <= 0) return { bf: null, sum: 0 };
      db =
        1.0994921 -
        0.0009929 * sum +
        0.0000023 * (sum * sum) -
        0.0001392 * age;
    }
  } else {
    sum =
      folds.chest +
      folds.axilla +
      folds.triceps +
      folds.subscapular +
      folds.abdomen +
      folds.suprailiac +
      folds.thigh;
    if (sum <= 0) return { bf: null, sum: 0 };

    if (sex === 'male') {
      db =
        1.112 -
        0.00043499 * sum +
        0.00000055 * (sum * sum) -
        0.00028826 * age;
    } else {
      db =
        1.097 -
        0.00046971 * sum +
        0.00000056 * (sum * sum) -
        0.00012828 * age;
    }
  }

  const bf = 495 / db - 450;
  return { bf: clampBF(bf), sum };
}

// Método de Estimación por IMC (Deurenberg et al.)
function calculateDeurenbergBF(sex, age, bmi) {
  if (!bmi || bmi <= 0) return null;
  const sexFlag = sex === 'male' ? 1 : 0;
  const bf = 1.2 * bmi + 0.23 * age - 10.8 * sexFlag - 5.4;
  return clampBF(bf);
}

function clampBF(val) {
  if (!Number.isFinite(val)) return null;
  return Math.max(2.0, Math.min(65.0, val));
}

/**
 * 2. CLASIFICACIÓN ACE (AMERICAN COUNCIL ON EXERCISE) Y OMS
 */
function getAceClassification(sex, bf) {
  if (sex === 'male') {
    if (bf < 6) return { label: 'Esencial', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' };
    if (bf < 14) return { label: 'Atleta', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' };
    if (bf < 18) return { label: 'Fitness', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.16)' };
    if (bf < 25) return { label: 'Aceptable', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' };
    return { label: 'Obesidad', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)' };
  } else {
    if (bf < 14) return { label: 'Esencial', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' };
    if (bf < 21) return { label: 'Atleta', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' };
    if (bf < 25) return { label: 'Fitness', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.16)' };
    if (bf < 32) return { label: 'Aceptable', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' };
    return { label: 'Obesidad', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)' };
  }
}

function getSpectrumPositionPercent(sex, bf) {
  // Mapea el % de grasa a la barra visual de 5 segmentos:
  // Segmentos tienen anchos: Esencial (14%), Atleta (22%), Fitness (16%), Aceptable (24%), Obesidad (24%)
  const breaks = sex === 'male' ? [2, 6, 14, 18, 25, 38] : [10, 14, 21, 25, 32, 45];
  const segWidths = [14, 22, 16, 24, 24];
  const cumStarts = [0, 14, 36, 52, 76];

  if (bf <= breaks[0]) return 2;
  if (bf >= breaks[5]) return 98;

  for (let i = 0; i < 5; i++) {
    if (bf <= breaks[i + 1]) {
      const ratio = (bf - breaks[i]) / (breaks[i + 1] - breaks[i]);
      return cumStarts[i] + ratio * segWidths[i];
    }
  }
  return 98;
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return 'Bajo peso (OMS)';
  if (bmi < 25.0) return 'Peso normal (OMS)';
  if (bmi < 30.0) return 'Sobrepeso (OMS)';
  if (bmi < 35.0) return 'Obesidad Grado I (OMS)';
  return 'Obesidad Grado II+ (OMS)';
}

/**
 * 3. LECTURA DE ENTRADAS Y ACTUALIZACIÓN DE INTERFAZ
 */
function getInputsInMetric() {
  const isImp = state.unit === 'imperial';
  const lenFactor = isImp ? CM_PER_INCH : 1;
  const wtFactor = isImp ? KG_PER_LB : 1;

  const age = parseFloat(els.inputAge.value) || 28;
  const heightCm = (parseFloat(els.inputHeight.value) || 0) * lenFactor;
  const weightKg = (parseFloat(els.inputWeight.value) || 0) * wtFactor;
  const activity = parseFloat(els.selectActivity.value) || 1.55;

  const neckCm = (parseFloat(els.inputNeck.value) || 0) * lenFactor;
  const waistCm = (parseFloat(els.inputWaist.value) || 0) * lenFactor;
  const hipCm = (parseFloat(els.inputHip.value) || 0) * lenFactor;

  const folds = {
    chest: parseFloat(els.sfChest.value) || 0,
    triceps: parseFloat(els.sfTriceps.value) || 0,
    abdomen: parseFloat(els.sfAbdomen.value) || 0,
    suprailiac: parseFloat(els.sfSuprailiac.value) || 0,
    thigh: parseFloat(els.sfThigh.value) || 0,
    subscapular: parseFloat(els.sfSubscapular.value) || 0,
    axilla: parseFloat(els.sfAxilla.value) || 0,
  };

  return { age, heightCm, weightKg, activity, neckCm, waistCm, hipCm, folds };
}

function formatWeight(kg) {
  if (state.unit === 'imperial') {
    return `${(kg / KG_PER_LB).toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

function updateCalculations() {
  const data = getInputsInMetric();
  const heightM = data.heightCm / 100;
  const bmi = heightM > 0 ? data.weightKg / (heightM * heightM) : 0;

  // Calcular los 3 métodos simultáneamente
  const navyBf = calculateNavyBF(
    state.sex,
    data.heightCm,
    data.neckCm,
    data.waistCm,
    data.hipCm
  );
  const jpRes = calculateJacksonPollockBF(
    state.sex,
    data.age,
    state.jpMode,
    data.folds
  );
  const bmiBf = calculateDeurenbergBF(state.sex, data.age, bmi);

  // Actualizar barra de suma de pliegues
  els.sfCountLabel.textContent = `${state.jpMode} sitios`;
  els.sfSumValue.textContent = `${jpRes.sum.toFixed(1)} mm`;

  // Mostrar comparativa rápida de los 3 métodos
  els.compNavyVal.textContent = navyBf !== null ? `${navyBf.toFixed(1)}%` : '—';
  els.compJpVal.textContent = jpRes.bf !== null ? `${jpRes.bf.toFixed(1)}%` : '—';
  els.compBmiVal.textContent = bmiBf !== null ? `${bmiBf.toFixed(1)}%` : '—';

  // Determinar el % de grasa activo según la pestaña seleccionada
  let activeBf = navyBf;
  let methodTitle = 'Método Marina de EE. UU.';
  if (state.method === 'skinfold') {
    activeBf = jpRes.bf;
    methodTitle = `Pliegues Jackson-Pollock (${state.jpMode} sitios)`;
  } else if (state.method === 'bmi') {
    activeBf = bmiBf;
    methodTitle = 'Estimación por IMC (Deurenberg)';
  }

  els.activeMethodBadge.textContent = methodTitle;

  if (activeBf === null || data.weightKg <= 0 || data.heightCm <= 0) {
    els.bfPercentageValue.textContent = '—';
    return;
  }

  // Número principal y categoría ACE
  els.bfPercentageValue.textContent = activeBf.toFixed(1);
  const ace = getAceClassification(state.sex, activeBf);
  els.aceCategoryChip.textContent = ace.label;
  els.aceCategoryChip.style.color = ace.color;
  els.aceCategoryChip.style.background = ace.bg;
  els.aceCategoryChip.style.borderColor = ace.color;

  // Posición del puntero en la barra ACE
  const pointerPos = getSpectrumPositionPercent(state.sex, activeBf);
  els.spectrumPointer.style.left = `${pointerPos.toFixed(1)}%`;

  // Resaltar fila activa en la tabla ACE
  document.querySelectorAll('.ace-table tbody tr').forEach((row) => {
    row.classList.toggle('highlight-row', row.dataset.cat === ace.label);
  });

  // Desglose Masa Grasa vs Masa Magra
  const fatMassKg = data.weightKg * (activeBf / 100);
  const leanMassKg = data.weightKg - fatMassKg;
  const leanPct = 100 - activeBf;
  const essentialPct = state.sex === 'male' ? 3 : 12;
  const essentialKg = data.weightKg * (essentialPct / 100);

  els.barLeanWidth.style.width = `${Math.max(10, leanPct).toFixed(1)}%`;
  els.barFatWidth.style.width = `${Math.min(90, activeBf).toFixed(1)}%`;
  els.leanMassLegend.textContent = `${formatWeight(leanMassKg)} (${leanPct.toFixed(1)}%)`;
  els.fatMassLegend.textContent = `${formatWeight(fatMassKg)} (${activeBf.toFixed(1)}%)`;

  els.fatMassValue.textContent = formatWeight(fatMassKg);
  els.essentialFatNote.textContent = `Grasa esencial mín.: ~${formatWeight(essentialKg)} (${essentialPct}%)`;
  els.leanMassValue.textContent = formatWeight(leanMassKg);

  // IMC y FFMI
  els.bmiValue.textContent = bmi.toFixed(1);
  els.bmiCategorySub.textContent = getBmiCategory(bmi);

  const ffmi = leanMassKg / (heightM * heightM);
  const ffmiNormalized = ffmi + 6.1 * (1.8 - heightM);
  els.ffmiValue.textContent = ffmi.toFixed(1);
  els.ffmiNormalizedSub.textContent = `Normalizado (1.80m): ${ffmiNormalized.toFixed(1)}`;

  // Metabolismo Basal (Katch-McArdle) y TDEE
  const bmrKatch = Math.round(370 + 21.6 * leanMassKg);
  const tdee = Math.round(bmrKatch * data.activity);
  const deficit = Math.round(tdee * 0.8);
  const surplus = Math.round(tdee * 1.1);

  els.bmrKatchValue.textContent = `${bmrKatch.toLocaleString('es-ES')} kcal/día`;
  els.tdeeValue.textContent = `${tdee.toLocaleString('es-ES')} kcal/día`;
  els.calDeficit.textContent = `${deficit.toLocaleString('es-ES')} kcal`;
  els.calMaintenance.textContent = `${tdee.toLocaleString('es-ES')} kcal`;
  els.calSurplus.textContent = `${surplus.toLocaleString('es-ES')} kcal`;

  // Simulador de objetivo
  const goalBf = parseFloat(els.inputGoalBf.value) || 14;
  els.goalTargetLabel.textContent = `Meta: ${goalBf.toFixed(1)}%`;
  const targetWeightKg = leanMassKg / (1 - goalBf / 100);
  const deltaKg = targetWeightKg - data.weightKg;

  els.goalTargetWeight.textContent = formatWeight(targetWeightKg);
  if (Math.abs(deltaKg) < 0.15) {
    els.goalFatDelta.textContent = '¡Estás en tu meta!';
    els.goalFatDelta.style.color = '#10b981';
  } else if (deltaKg < 0) {
    els.goalFatDelta.textContent = `Perder ${formatWeight(Math.abs(deltaKg))} de grasa`;
    els.goalFatDelta.style.color = '#38bdf8';
  } else {
    els.goalFatDelta.textContent = `+${formatWeight(deltaKg)} margen`;
    els.goalFatDelta.style.color = '#f59e0b';
  }

  return {
    bf: activeBf,
    method: methodTitle,
    weightKg: data.weightKg,
    fatMassKg,
    leanMassKg,
    category: ace.label,
  };
}

/**
 * 4. GESTIÓN DE VISIBILIDAD DE CAMPOS SEGÚN SEXO Y MODO
 */
function syncVisibilityAndLabels() {
  const isFemale = state.sex === 'female';

  // Mostrar/ocultar cadera en Marina EE. UU.
  els.hipInputContainer.classList.toggle('hidden', !isFemale);
  els.waistHelpText.textContent = isFemale
    ? 'En el punto más estrecho del abdomen (cintura natural)'
    : 'A nivel del ombligo al final de una espiración normal';

  // Mostrar/ocultar pliegues según Jackson-Pollock 3 o 7 y sexo
  const activeKey = state.jpMode === 7 ? 'all7' : isFemale ? 'female3' : 'male3';
  document.querySelectorAll('.sf-field').forEach((field) => {
    const allowed = field.dataset.sites.split(',');
    field.classList.toggle('hidden', !allowed.includes(activeKey));
  });

  // Actualizar marcas del espectro ACE según sexo
  const ticks = isFemale
    ? ['10%', '14%', '21%', '25%', '32%', '45%+']
    : ['2%', '6%', '14%', '18%', '25%', '38%+'];
  els.aceSpectrumTicks.innerHTML = ticks.map((t) => `<span>${t}</span>`).join('');
}

/**
 * 5. CAMBIO DE UNIDADES MÉTRICO <-> IMPERIAL
 */
function switchUnitSystem(newUnit) {
  if (state.unit === newUnit) return;
  const toImperial = newUnit === 'imperial';
  state.unit = newUnit;

  els.btnUnitMetric.classList.toggle('active', !toImperial);
  els.btnUnitImperial.classList.toggle('active', toImperial);

  // Actualizar etiquetas visuales
  document.querySelectorAll('[data-unit-type="length"]').forEach((el) => {
    el.textContent = toImperial ? 'in' : 'cm';
  });
  document.querySelectorAll('[data-unit-type="weight"]').forEach((el) => {
    el.textContent = toImperial ? 'lb' : 'kg';
  });

  // Convertir valores numéricos en los inputs de longitud y peso
  const lengthInputs = [els.inputHeight, els.inputNeck, els.inputWaist, els.inputHip];
  lengthInputs.forEach((inp) => {
    const val = parseFloat(inp.value);
    if (Number.isFinite(val)) {
      const converted = toImperial ? val / CM_PER_INCH : val * CM_PER_INCH;
      inp.value = converted.toFixed(1);
    }
  });

  const wtVal = parseFloat(els.inputWeight.value);
  if (Number.isFinite(wtVal)) {
    const convertedWt = toImperial ? wtVal / KG_PER_LB : wtVal * KG_PER_LB;
    els.inputWeight.value = convertedWt.toFixed(1);
  }

  updateCalculations();
  renderHistory();
}

/**
 * 6. HISTORIAL EN LOCALSTORAGE
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(state.historyKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCurrentToHistory() {
  const current = updateCalculations();
  if (!current || !current.bf) return;

  const list = loadHistory();
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    bf: current.bf,
    weightKg: current.weightKg,
    leanMassKg: current.leanMassKg,
    fatMassKg: current.fatMassKg,
    category: current.category,
    method: current.method,
  };

  list.unshift(entry);
  localStorage.setItem(state.historyKey, JSON.stringify(list.slice(0, 20)));
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  els.historyCount.textContent = list.length;

  if (list.length === 0) {
    els.historyList.innerHTML =
      '<p class="empty-history">Aún no hay mediciones guardadas.</p>';
    return;
  }

  els.historyList.innerHTML = list
    .map(
      (item) => `
      <div class="history-item">
        <div>
          <strong>${item.bf.toFixed(1)}% Grasa (${item.category})</strong>
          <div style="font-size:0.72rem;color:#94a3b8;">
            ${item.date} · ${item.method}
          </div>
        </div>
        <div style="text-align:right;">
          <div>Peso: <strong>${formatWeight(item.weightKg)}</strong></div>
          <div style="font-size:0.72rem;color:#38bdf8;">Magra: ${formatWeight(item.leanMassKg)}</div>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * 7. INICIALIZACIÓN DE EVENTOS
 */
function initEvents() {
  // Unidades
  els.btnUnitMetric.addEventListener('click', () => switchUnitSystem('metric'));
  els.btnUnitImperial.addEventListener('click', () => switchUnitSystem('imperial'));

  // Sexo biológico
  [els.sexMale, els.sexFemale].forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sex = btn.dataset.sex;
      els.sexMale.classList.toggle('active', state.sex === 'male');
      els.sexFemale.classList.toggle('active', state.sex === 'female');
      els.sexMale.setAttribute('aria-checked', state.sex === 'male');
      els.sexFemale.setAttribute('aria-checked', state.sex === 'female');

      // Ajustar meta sugerida por defecto según sexo
      els.inputGoalBf.value = state.sex === 'male' ? 14 : 21;
      syncVisibilityAndLabels();
      updateCalculations();
    });
  });

  // Pestañas de método (Navy, Skinfold, BMI)
  document.querySelectorAll('.method-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.method = tab.dataset.method;
      document.querySelectorAll('.method-tab').forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active);
      });

      document.getElementById('paneNavy').classList.toggle('active', state.method === 'navy');
      document.getElementById('paneSkinfold').classList.toggle('active', state.method === 'skinfold');
      document.getElementById('paneBmi').classList.toggle('active', state.method === 'bmi');

      updateCalculations();
    });
  });

  // Selector de 3 o 7 pliegues en Jackson-Pollock
  document.querySelectorAll('.jp-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.jpMode = parseInt(btn.dataset.jpmode, 10);
      document.querySelectorAll('.jp-mode-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      syncVisibilityAndLabels();
      updateCalculations();
    });
  });

  // Sub-pestañas Tabla ACE / Historial
  document.querySelectorAll('.subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.subtab;
      document.querySelectorAll('.subtab-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      document.querySelectorAll('.subtab-content').forEach((pane) =>
        pane.classList.toggle('active', pane.id === target)
      );
    });
  });

  // Escuchar todos los inputs numéricos y selectores en tiempo real
  document.querySelectorAll('input, select').forEach((input) => {
    input.addEventListener('input', updateCalculations);
    input.addEventListener('change', updateCalculations);
  });

  // Botones de historial
  els.btnSaveRecord.addEventListener('click', saveCurrentToHistory);
  els.btnClearHistory.addEventListener('click', () => {
    localStorage.removeItem(state.historyKey);
    renderHistory();
  });
}

// Arranque inicial
syncVisibilityAndLabels();
initEvents();
updateCalculations();
renderHistory();
