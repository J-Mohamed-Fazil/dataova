import { ActiveTab } from '../../store/workspaceContext';

export interface TutorialStep {
  id: string;
  stepNumber: number;
  totalSteps: number;
  title: string;
  tab?: ActiveTab;
  category: string;
  featureName: string;
  badge: string;
  badgeColor: string;
  
  // Phase 1: AI Leading the Action
  actionLead: string;
  actionSpeech: string;
  targetSelector?: string;
  actionType?: 'click' | 'inspect' | 'modal_flow';
  pointerLabel: string;
  actionDelayMs?: number;

  // Phase 2: AI Explaining the Output in Full Depth
  outputBreakdown: string;
  outputSpeech: string;
  outputHighlightSelector?: string;
  keyMetricNotice: string;
  strategicValue: string;

  // Beginner-Friendly Fields (plain language for fresh users)
  beginnerExplain: string;   // What does this feature do? (no jargon)
  outputMeaning: string;     // What does this output mean for YOU?
  whatIsSeen: string;        // What you see on screen right now
  novaQuip: string;          // Nova's personality opener for this step
  freshUserTip: string;      // Step-by-step tip for someone brand new
  outputGlossary: Record<string, string>; // Key terms → simple definitions
  appContext: string;        // "What section of DATOVA is this?" (1 sentence)
  whatToDoNext: string;      // Actionable next step after this feature
  
  // Modal cleanup
  cleanupSelector?: string;
  cleanupDelayMs?: number;

  robotExpression: 'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink' | 'teaching';
}

// Step 0 — Welcome (special, no action/output phases)
export interface WelcomeStep {
  id: 'welcome';
  title: string;
  subtitle: string;
  novaIntro: string;
  whatIsDataova: string;
  whoIsItFor: string;
  howTourWorks: string;
  quickSections: Array<{ name: string; icon: string; description: string }>;
}

export const WELCOME_STEP: WelcomeStep = {
  id: 'welcome',
  title: 'Welcome to DATOVA AI',
  subtitle: 'Your intelligent data analytics co-pilot — no coding required',
  novaIntro: "Hi! I'm Nova, your personal 3D AI guide. I'll walk you through everything DATOVA AI can do — step by step, in plain English. You won't need to know any coding or data science to follow along!",
  whatIsDataova: 'DATOVA AI is an intelligent analytics platform that takes your raw data files (CSV, Excel, etc.) and automatically transforms them into charts, predictions, insights, and executive reports — all without writing a single line of code. Think of it as having a team of data scientists, business analysts, and report writers working for you instantly.',
  whoIsItFor: 'DATOVA AI is designed for business owners, managers, analysts, students, and anyone who has data but wants answers without the complexity. Whether you have sales data, HR records, financial reports, or survey results — DATOVA AI can analyze it.',
  howTourWorks: "This tour has 16 steps. In each step, I'll: ① Show you a feature by clicking it live, then ② Explain what the output means in plain English. You can pause, replay, or jump to any step at any time.",
  quickSections: [
    { name: 'Overview', icon: '🏠', description: 'Your data snapshot — domain detection, KPIs, and health score at a glance' },
    { name: 'Dashboard', icon: '📊', description: 'Auto-generated interactive charts for your data' },
    { name: 'Forecast', icon: '📈', description: 'Predict future trends using AI time-series models' },
    { name: 'ML Segments', icon: '🎯', description: 'Automatically group your data into meaningful clusters' },
    { name: 'AutoML Studio', icon: '🤖', description: 'Train and test prediction models — no expertise needed' },
    { name: 'Data Prep', icon: '🧹', description: 'Find and fix data quality issues in one click' },
    { name: 'SQL Lab', icon: '⚡', description: 'Ask questions in plain English and get database answers instantly' },
    { name: 'Ask DATOVA', icon: '💬', description: 'Chat with your data like talking to a smart analyst' },
    { name: 'Reports', icon: '📄', description: 'Export boardroom-ready PDFs, slides, and audio briefings' },
  ]
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome-ingest',
    stepNumber: 1,
    totalSteps: 16,
    title: 'Autonomous Data Ingestion & Schema Profiling',
    category: 'Data Engineering',
    featureName: 'Universal Data Ingestion',
    badge: '1-Click Ingestion',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    novaQuip: "Let me show you the first magic — loading your data! Watch me click the button right now.",
    appContext: 'This is the starting point of DATOVA — getting your data in. You only do this once per dataset.',
    
    // Phase 1
    actionLead:
      'I am taking control to initiate autonomous data ingestion. Watch as my laser pointer glides to the "Load Sample" button for our Global Retail & E-Commerce dataset and executes the ingestion request live on the server.',
    actionSpeech:
      "Hello! I am Nova, your 3D AI Co-Pilot! I am taking control to demonstrate DATOVA AI live. Watch as I automatically load our Global Retail and E-Commerce dataset right now.",
    targetSelector: '[data-tour="load-sample-retail"]',
    actionType: 'click',
    pointerLabel: 'Nova Clicking: Load Sample Retail Dataset',
    actionDelayMs: 2500,

    // Phase 2
    outputBreakdown:
      'The dataset is now loaded and profiled in memory! Look at the active workspace: 30 transactions across 10 features were ingested in under 60 milliseconds. Headers were sanitized, data encodings resolved, and deterministic profiling commenced across every numeric, categorical, and timestamp column.',
    outputSpeech:
      "Dataset ingested successfully! Notice that 30 transactions across 10 columns are now live in our in-memory engine. All data encodings and data types have been automatically parsed and profiled without writing a single line of code.",
    keyMetricNotice: '30 rows • 10 columns • 100% In-Memory SQLite Table mapped',
    strategicValue: 'Zero ETL pipeline friction: drop raw business spreadsheets and get instant analysis.',
    beginnerExplain: 'Think of this like opening a spreadsheet — but instead of just viewing it, DATOVA instantly reads, understands, and prepares your data for full AI analysis. No coding needed.',
    outputMeaning: 'Your data is now live inside DATOVA. Every other feature on this tour will use it. You can see the row and column count at the top of the screen.',
    whatIsSeen: 'The topbar now shows your dataset name, row count, and column count. The workspace is ready for analysis.',
    freshUserTip: '1. Click the "Load Sample" button or use "Ingest Data" to upload your own file.\n2. DATOVA automatically reads the file — no settings to configure.\n3. The workspace activates once data is loaded.',
    whatToDoNext: 'Head to the Overview tab to see your data\'s automatic summary, domain detection, and health score.',
    outputGlossary: {
      'In-Memory': 'Data is loaded directly into the computer\'s fast RAM, not a slow database file — this is why everything is near-instant.',
      'Schema Profiling': 'DATOVA reads and categorizes each column (numbers, text, dates) automatically.',
      'Data Ingestion': 'The process of loading your raw file into DATOVA so it can analyze it.'
    },
    robotExpression: 'wave'
  },
  {
    id: 'overview-domain',
    stepNumber: 2,
    totalSteps: 16,
    title: 'Autonomous Domain Context Classification',
    category: 'Core Intelligence',
    featureName: 'Universal Domain Detection',
    badge: 'Context Engine',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    tab: 'overview',
    novaQuip: "Watch this — DATOVA figured out what industry your data is from automatically! No setup needed.",
    appContext: 'The Overview tab is your data\'s "home page" — it shows the big picture before you dive into specific analyses.',
    
    // Phase 1
    actionLead:
      'I am navigating to the Overview dashboard to spotlight our autonomous domain inference engine. Watch my laser focus on the Domain Classification Card.',
    actionSpeech:
      "Now, let us examine the Overview dashboard. Watch as I spotlight the Domain Intelligence card at the top.",
    targetSelector: '[data-tour="overview-domain"]',
    actionType: 'inspect',
    pointerLabel: 'Nova Spotlighting: Domain Inference Badge',
    actionDelayMs: 2000,

    // Phase 2
    outputBreakdown:
      'Look at the active badge: "Retail & E-Commerce" with 96% Model Confidence! The engine scanned vocabulary tokens like "Sales", "Discount", "Quantity", and "Customer_ID". Instead of treating the numbers as abstract generic mathematics, the system automatically tailors all KPI definitions, forecast models, and cohort clusters specifically for commercial merchandise analytics.',
    outputSpeech:
      "Look closely at the active profile: DATOVA classified this dataset as Retail and E-Commerce with 96% model confidence! This means every metric, chart, and predictive model across the entire workspace is now tailored specifically for retail performance.",
    keyMetricNotice: 'Inferred Domain: Retail & E-Commerce • Confidence: 96%',
    strategicValue: 'Domain-aware AI eliminates generic answers, providing industry-specific KPI formulas and recommendations.',
    beginnerExplain: 'DATOVA reads your column names and data patterns to figure out what industry your data belongs to — like a smart assistant who instantly knows whether you work in retail, HR, finance, or education.',
    outputMeaning: 'The "Retail & E-Commerce" badge means DATOVA will use retail-specific formulas (like Net Revenue, Discount Rate, Basket Size) instead of generic ones. Your analysis is automatically industry-relevant.',
    whatIsSeen: 'A domain badge at the top of the Overview page showing the detected industry and a confidence percentage.',
    freshUserTip: '1. Load any data file — DATOVA reads the column names automatically.\n2. The domain badge appears at the top of the Overview page.\n3. The confidence % tells you how sure DATOVA is about the detected domain.',
    whatToDoNext: 'Look at the KPI cards below the domain badge — they show auto-calculated metrics relevant to your detected domain.',
    outputGlossary: {
      'Domain': 'The industry or category your data belongs to (e.g., Retail, HR, Finance).',
      'Confidence': 'How sure the AI is about its classification, expressed as a percentage.',
      'KPI': 'Key Performance Indicator — an important number that measures business health (e.g., Total Revenue, Conversion Rate).'
    },
    robotExpression: 'happy'
  },
  {
    id: 'overview-health',
    stepNumber: 3,
    totalSteps: 16,
    title: '3D Data Health & Hygiene Audit Score',
    category: 'Core Intelligence',
    featureName: '0-100 Integrity Gauge',
    badge: 'Integrity Audit',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tab: 'overview',
    novaQuip: "Before we trust any number, we need to check if the data is clean. Let me show you our health score!",
    appContext: 'Still on the Overview page — this gauge appears right next to the domain badge as your data\'s "quality report card".',

    // Phase 1
    actionLead:
      'Before trusting data for executive presentations, we must audit its structural hygiene. I am now spotlighting the 3D Cybernetic Health Gauge.',
    actionSpeech:
      "Before making business decisions, we must verify the cleanliness of the data. Watch as I spotlight the 3D Health Integrity Gauge.",
    targetSelector: '[data-tour="overview-health"]',
    actionType: 'inspect',
    pointerLabel: 'Nova Spotlighting: 0-100 Health Integrity Gauge',
    actionDelayMs: 2000,

    // Phase 2
    outputBreakdown:
      'The Health Score evaluates to 88/100 (Healthy). The engine scanned every cell: 0% duplicate rows, 3.2% missing discount rates, zero schema type corruptions, and 2 mild statistical outliers. Scores above 80 indicate high analytical reliability, meaning the data is safe for executive forecasting and machine learning.',
    outputSpeech:
      "Notice the score of 88 out of 100! The engine audited every cell for nulls, duplicates, and schema corruption. A score above 80 confirms that this data is mathematically sound and ready for executive presentations.",
    keyMetricNotice: 'Health Score: 88/100 • Missing Cells: 3.2% • Duplicates: 0%',
    strategicValue: 'Guarantees leadership decisions are never made on corrupt, incomplete, or duplicated data.',
    beginnerExplain: 'Like a quality check before shipping a product — this score tells you how clean and trustworthy your data is, from 0 (very messy) to 100 (perfect). Higher scores mean your analysis results will be more reliable.',
    outputMeaning: 'A score of 88/100 means your data is in great shape. There are a few missing values (3.2%) but no duplicates. You can safely trust the charts and numbers you see throughout the app.',
    whatIsSeen: 'A 3D circular gauge dial showing a score from 0–100, with a color-coded health status (green = healthy, amber = warning, red = critical).',
    freshUserTip: '1. The score appears automatically when data is loaded — no action needed.\n2. Green (80-100) = safe to analyze. Amber (50-79) = some issues. Red (0-49) = clean your data first.\n3. Click the "Data Prep" tab to fix issues and boost your score.',
    whatToDoNext: 'If your score is below 80, visit the Data Prep tab (Step 12) to auto-fix issues and raise the score.',
    outputGlossary: {
      'Missing Values': 'Cells in your data that are blank or empty — like a table with some rows missing a value in one column.',
      'Duplicates': 'Identical rows that appear more than once — DATOVA removes them automatically if asked.',
      'Outliers': 'Data points that are abnormally far from the average — they can skew your analysis if not handled.',
      'Health Score': 'A 0-100 number summarizing how clean and reliable your data is across multiple dimensions.'
    },
    robotExpression: 'explain'
  },
  {
    id: 'overview-kpi-explain',
    stepNumber: 4,
    totalSteps: 16,
    title: 'Live KPI Formula Provenance (Zero Hallucinations)',
    category: 'Core Intelligence',
    featureName: 'Mathematical Explainability',
    badge: 'Full Provenance',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    tab: 'overview',
    novaQuip: "One of my favorite features — you can see EXACTLY how every number is calculated. No black box!",
    appContext: 'Each KPI card on the Overview page has an "Explain" button that opens a formula breakdown modal.',

    // Phase 1
    actionLead:
      'Many AI tools hallucinate numbers out of thin air. In DATOVA AI, every metric aggregate has 100% mathematical provenance. Watch as I click "Explain" on the Total Revenue KPI card live!',
    actionSpeech:
      "Many AI systems fabricate numbers. DATOVA AI is 100% deterministic. Watch as I click 'Explain' on the Total Revenue KPI card right now to inspect its mathematical formula!",
    targetSelector: '[data-tour="kpi-explain-0"]',
    actionType: 'modal_flow',
    pointerLabel: 'Nova Clicking: Explain Total Revenue Formula',
    actionDelayMs: 2200,

    // Phase 2
    outputBreakdown:
      'Look at the formula modal that just opened! The mathematical formula is: SUM(Sales - (Sales * Discount)). The exact computed value is displayed with zero rounding distortion, accompanied by an executive operational impact briefing explaining why Net Revenue is the primary top-line barometer for margin growth. Everything is verified server-side via Pandas & NumPy.',
    outputSpeech:
      "Look at the formula modal on screen! You can see the exact mathematical formula: SUM of Sales minus discounts. Every single calculation is verified server-side with Pandas and NumPy, guaranteeing zero hallucinations and total auditability.",
    keyMetricNotice: 'Formula: SUM(Sales - (Sales * Discount)) • 100% Deterministic',
    strategicValue: 'Builds unshakeable stakeholder trust: any metric can be defended in front of board auditors.',
    cleanupSelector: '[data-tour="kpi-modal-close"]',
    cleanupDelayMs: 6500,
    beginnerExplain: 'Each number you see (like "Total Revenue") comes with a receipt — the exact math formula used to calculate it. No guessing, no black-box AI making things up. You can verify every number.',
    outputMeaning: 'The popup shows the exact formula behind the metric. This means you can walk into any boardroom and explain exactly how the number was calculated — perfect for audits and presentations.',
    whatIsSeen: 'A popup modal showing a math formula, the computed value, and a plain-English explanation of what that metric means for the business.',
    freshUserTip: '1. Click the "Explain" button on any KPI card.\n2. Read the formula — it uses your actual column names.\n3. The result value shown is computed in real time from your data.',
    whatToDoNext: 'Try clicking "Explain" on different KPI cards to see how each metric is calculated differently.',
    outputGlossary: {
      'KPI': 'Key Performance Indicator — a critical business metric like Revenue, Profit Margin, or Conversion Rate.',
      'Formula': 'The mathematical calculation used to arrive at the number shown.',
      'SUM': 'Adds all values in a column together.',
      'Deterministic': 'The same input data always produces the same output — there\'s no randomness or guessing.'
    },
    robotExpression: 'teaching'
  },
  {
    id: 'data-hub',
    stepNumber: 5,
    totalSteps: 16,
    title: 'Data Hub: Paginated Records & Semantic Column Profiling',
    category: 'Data Engineering',
    featureName: 'Deep Column Profiling',
    badge: 'Data Hub Tab',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    tab: 'data',
    novaQuip: "Want to see your raw data and understand each column? This is your data explorer!",
    appContext: 'The Data tab shows your raw records in a table and provides detailed statistics for every column.',

    // Phase 1
    actionLead:
      'I am navigating to the Data Hub to demonstrate deep schema profiling. Watch as I click the Data Hub navigation item in the sidebar.',
    actionSpeech:
      "Now I am switching our workspace to the Data Hub. Watch as I click the Data Hub tab in the sidebar.",
    targetSelector: '[data-tour="tab-data"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Data Hub',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'We are inside the Data Hub! Notice the top table displaying paginated records with instant column sorting and search. Look below at the semantic column profiling cards: DATOVA classified columns into Numeric, Categorical, and Date types, computing min, max, mean, standard deviation, cardinality, and missing percentage for each column.',
    outputSpeech:
      "We are now in the Data Hub! Here you can paginate through raw records and examine deep column statistics, including cardinality, standard deviation, min, max, and missing rates for every single attribute.",
    keyMetricNotice: 'Semantic Types: 5 Numeric, 3 Categorical, 2 Date/Identifier',
    strategicValue: 'Analysts can spot data skews, verify column definitions, and audit quality in seconds.',
    beginnerExplain: 'This is like a supercharged spreadsheet viewer. Instead of just seeing your data rows, DATOVA also automatically profiles every column — telling you what kind of data it is, how spread out the values are, and whether anything looks unusual.',
    outputMeaning: 'The column cards show stats like Min, Max, Average, and how many unique values exist. Use these to quickly understand what\'s in each column without scrolling through hundreds of rows.',
    whatIsSeen: 'A table of your raw data rows at the top, and below it, cards for each column showing statistical summaries with icons indicating the data type.',
    freshUserTip: '1. Use the search bar to filter rows by keyword.\n2. Click any column header to sort by that column.\n3. Scroll down past the table to see the detailed column profile cards.',
    whatToDoNext: 'Click on any column profile card to expand its full statistics and distribution chart.',
    outputGlossary: {
      'Cardinality': 'The number of unique values in a column — high cardinality means many different values (like Customer IDs); low cardinality means few options (like Yes/No).',
      'Standard Deviation': 'How spread out the values are around the average — higher = more variation.',
      'Categorical': 'A column that contains labels or categories, not numbers (e.g., "Region", "Product Type").',
      'Numeric': 'A column with measurable numbers (e.g., "Sales Amount", "Quantity").'
    },
    robotExpression: 'thinking'
  },
  {
    id: 'insights-anomalies',
    stepNumber: 6,
    totalSteps: 16,
    title: 'Statistical Anomaly Detection & Prescriptive Insights',
    category: 'Core Intelligence',
    featureName: 'IQR & Z-Score Anomaly Engine',
    badge: 'Insights Tab',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    tab: 'insights',
    novaQuip: "I found some weird stuff in your data! Let me show you the anomalies and what they mean.",
    appContext: 'The Insights tab automatically scans your data for unusual patterns, outliers, and strategic observations.',

    // Phase 1
    actionLead:
      'I am taking us to the Insights view to reveal statistical anomalies. Watch as my pointer clicks the Insights tab in the sidebar.',
    actionSpeech:
      "Let us explore the Insights view. Watch as I click on the Insights tab in the sidebar.",
    targetSelector: '[data-tour="tab-insights"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Insights Tab',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Look at the anomaly cards and strategic insights! DATOVA applied Interquartile Range (IQR) and Z-score filters to find abnormal spikes. Notice the flagged transaction: a 65% discount rate on an enterprise order exceeding 3 standard deviations from normal! Each anomaly includes an automated prescriptive recommendation on how to remediate the leak.',
    outputSpeech:
      "Look at the anomalies detected on screen! DATOVA used IQR and Z-scores to spot abnormal outliers, such as extreme discounts and order spikes, accompanied by clear prescriptive advice on how to mitigate operational risks.",
    keyMetricNotice: 'IQR Outliers: 2 Flagged Transactions • Confidence: p < 0.01',
    strategicValue: 'Detect operational revenue leakage, fraud, and supply bottlenecks before they compound.',
    beginnerExplain: 'Imagine having a colleague who reads all your data overnight and highlights the weird stuff — orders with unusually high discounts, sales that spiked unexpectedly, or patterns that don\'t match the rest. That\'s what this does, automatically.',
    outputMeaning: 'Each flagged card shows an unusual data point and explains in plain language WHY it\'s unusual and WHAT you should consider doing about it. These are your early warning signals.',
    whatIsSeen: 'Colored alert cards highlighting unusual rows in your data, with a description of the anomaly and a recommended action.',
    freshUserTip: '1. Red cards = high-priority anomalies to investigate.\n2. Amber cards = moderate anomalies worth monitoring.\n3. Each card has a "Drill Down" button to see the affected rows in the Data Hub.',
    whatToDoNext: 'Click on any anomaly card to see which specific rows are flagged, then decide whether to fix them in Data Prep or keep them as valid edge cases.',
    outputGlossary: {
      'IQR (Interquartile Range)': 'A measure of how spread out the middle 50% of values are. Points far outside this range are flagged as outliers.',
      'Z-Score': 'How many standard deviations a value is from the average. Z-scores above 3 are considered statistically anomalous.',
      'Prescriptive': 'Not just describing the problem, but also recommending what action to take.',
      'p < 0.01': 'Statistical shorthand for "less than 1% chance this anomaly is due to random variation" — meaning it\'s very likely a real issue.'
    },
    robotExpression: 'wink'
  },
  {
    id: 'dashboard-multi-sheet',
    stepNumber: 7,
    totalSteps: 16,
    title: 'Interactive Multi-Sheet Dashboard Architecture',
    category: 'Visualization',
    featureName: 'Dynamic Multi-Sheet Navigation',
    badge: 'Dashboard Tab',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    tab: 'dashboard',
    novaQuip: "Now the fun part — interactive charts! Everything is auto-generated from your data.",
    appContext: 'The Dashboard tab shows your data as interactive charts, organized into multiple themed analytical sheets.',

    // Phase 1
    actionLead:
      'I am navigating to the Interactive Dashboard view to showcase multi-sheet visualization architecture. Watch as I click the Dashboard tab.',
    actionSpeech:
      "Now, let us examine the Dashboard. Watch as I click the Dashboard tab to reveal our interactive visualization suite.",
    targetSelector: '[data-tour="tab-dashboard"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Dashboard',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Observe how the dashboard is structured into tabbed analytical sheets (Overview, Segment Deep Dive). Notice the interactive charts rendered with Recharts: Bar charts comparing regional revenue, line trends over time, and pie distributions. Hovering over any bar or line point displays exact dollar figures and percentage contributions.',
    outputSpeech:
      "Notice how the dashboard is organized into multi-sheet tabs! You have bar charts, line trends, and distribution pies with responsive hover tooltips showing exact metrics and currency values.",
    keyMetricNotice: 'Multi-Sheet Structure • Responsive Recharts • Interactive Tooltips',
    strategicValue: 'Organize complex multi-departmental analyses into clean, executive-ready tabs.',
    beginnerExplain: 'Think of this as your business control center — automatically-generated charts showing your data from multiple angles. No need to build charts in Excel; DATOVA creates them instantly and makes them interactive.',
    outputMeaning: 'Each chart tab answers a different question about your data. Hover over any bar or line to see exact numbers. Switch tabs to explore different perspectives like trends over time or category breakdowns.',
    whatIsSeen: 'Multiple chart tabs with bar charts, line graphs, and pie charts. Hovering shows exact values in tooltips. You can switch between different analytical views.',
    freshUserTip: '1. Click different tabs at the top of the dashboard to see different chart groups.\n2. Hover your mouse over any bar or line to see the exact value.\n3. Click the pencil icon on any chart to customize it (covered in the next step).',
    whatToDoNext: 'Try clicking the pencil icon on any chart to open the Chart Customizer and change what data is displayed.',
    outputGlossary: {
      'Bar Chart': 'Shows values as vertical or horizontal bars — great for comparing categories.',
      'Line Chart': 'Shows values over time as a connected line — great for trends.',
      'Pie Chart': 'Shows parts of a whole as slices — great for proportions.',
      'Tooltip': 'A small popup that shows exact values when you hover over a chart element.'
    },
    robotExpression: 'happy'
  },
  {
    id: 'dashboard-chart-editor',
    stepNumber: 8,
    totalSteps: 16,
    title: 'Live In-Place Chart Customizer & Live Re-Render',
    category: 'Visualization',
    featureName: 'Live Chart Customizer',
    badge: 'Pencil Icon Editor',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    tab: 'dashboard',
    novaQuip: "You're not stuck with the default charts! Let me show you how to customize any chart instantly.",
    appContext: 'The pencil icon on each dashboard chart opens the in-place editor — change chart type, axes, and aggregation without leaving the page.',

    // Phase 1
    actionLead:
      'Unlike static BI tools, you are never locked into pre-generated charts. Watch as I click the Pencil edit icon on this live chart right now!',
    actionSpeech:
      "Unlike static dashboards, you are never locked into predefined visuals. Watch as I click the pencil icon on this chart to customize it live!",
    targetSelector: '[data-tour="chart-edit-0"]',
    actionType: 'modal_flow',
    pointerLabel: 'Nova Clicking: Opening Live Chart Customizer',
    actionDelayMs: 2200,

    // Phase 2
    outputBreakdown:
      'Look at the Chart Editor modal! You can switch the chart from a Bar chart to Line, Area, or Pie chart, swap the category on the X-axis, change the numeric metric on the Y-axis, switch aggregation between SUM, AVG, MIN, MAX, and COUNT, or expand to full-width. When saved, the visualization re-renders instantly without a page refresh.',
    outputSpeech:
      "Look at the Chart Editor! You can switch chart types, alter X and Y axes, change aggregations from sum to average or count, and adjust layout dimensions with instant live re-rendering.",
    keyMetricNotice: 'Customizable: Type, Axes, Aggregations (SUM/AVG/COUNT), Layout',
    strategicValue: 'Tailor visualizations on the fly during executive meetings to answer spontaneous questions.',
    cleanupSelector: '[data-tour="chart-modal-close"]',
    cleanupDelayMs: 6500,
    beginnerExplain: 'You\'re not stuck with the charts DATOVA auto-generates. Click the pencil icon to customize any chart — change what data it shows, switch from bars to lines, or compare different columns. It\'s like having an on-demand custom report.',
    outputMeaning: 'The editor lets you change the chart type, what columns are on each axis, and how values are summed or averaged. Changes apply instantly — no waiting, no page reload.',
    whatIsSeen: 'A popup editor with dropdowns for chart type (Bar/Line/Pie), X-axis column, Y-axis metric, and aggregation method. A preview updates instantly as you change options.',
    freshUserTip: '1. Click the pencil icon on any chart card.\n2. Use the "Chart Type" dropdown to switch between Bar, Line, Pie, or Area.\n3. Use "X Axis" and "Y Axis" dropdowns to change what data is compared.\n4. Click "Save" to apply — the chart updates immediately.',
    whatToDoNext: 'Try creating a Pie chart showing revenue by category by changing Chart Type to "Pie" and X Axis to your category column.',
    outputGlossary: {
      'X Axis': 'The horizontal axis — usually shows categories (like Product Names, Months).',
      'Y Axis': 'The vertical axis — usually shows numeric values (like Revenue, Count).',
      'Aggregation': 'How to combine multiple rows into one value: SUM adds them, AVG averages them, COUNT counts them.',
      'Re-render': 'The chart updates visually in real time without needing a page refresh.'
    },
    robotExpression: 'explain'
  },
  {
    id: 'predictive-studio',
    stepNumber: 9,
    totalSteps: 16,
    title: 'AI Predictive Studio: Time-Series Forecasting & Uncertainty',
    category: 'Predictive & ML',
    featureName: 'Holt-Winters Exponential Smoothing',
    badge: 'Predictive Studio',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tab: 'forecast',
    novaQuip: "Now I'll show you something really powerful — predicting the future using your past data!",
    appContext: 'The Forecast tab uses advanced time-series AI to project your data trends into the future with statistical confidence bands.',

    // Phase 1
    actionLead:
      'I am taking us into the AI Predictive Studio to forecast future quarters. Watch as I click the Predictive Studio tab in the sidebar.',
    actionSpeech:
      "Now let us forecast the future! Watch as I navigate to the Predictive Studio in the sidebar.",
    targetSelector: '[data-tour="tab-forecast"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Predictive Studio',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Look at the forecast chart: the solid line shows verified historical actuals, and the dashed curve projects the future trajectory across 6 to 12 periods using Holt-Winters linear trend exponential smoothing. Notice the shaded 95% Confidence Interval band and the telemetry cards below showing Model Reliability (R²: 0.89) and Trajectory Momentum.',
    outputSpeech:
      "Look at the forecast curve! The solid line represents actual historical numbers, and the dashed path projects the future with a shaded 95% confidence interval band and an R-squared reliability score of 0.89!",
    keyMetricNotice: 'Horizon: 12 Periods • 95% Confidence Bounds • R²: 0.89',
    strategicValue: 'Anticipate future quarterly revenue and inventory demand with statistical confidence bounds.',
    beginnerExplain: 'This feature predicts what will happen next — like forecasting next quarter\'s sales based on past patterns. The shaded band around the prediction line shows the range of possible outcomes (best case to worst case).',
    outputMeaning: 'The solid line = what actually happened. The dashed line = what DATOVA predicts will happen next. The shaded area = the "uncertainty zone" — the wider it is, the less certain the prediction. R²: 0.89 means the model is 89% accurate.',
    whatIsSeen: 'A line chart with a solid historical section and a dashed future prediction section, with a shaded confidence band. Below are metric cards showing R², forecast horizon, and trend direction.',
    freshUserTip: '1. Select your target column (what you want to forecast) from the dropdown.\n2. Set the forecast horizon (how many future periods to predict).\n3. Click "Run Forecast" — the AI builds and displays the prediction curve automatically.',
    whatToDoNext: 'Adjust the forecast horizon slider to see shorter or longer prediction windows. Watch how the confidence band widens as you look further into the future.',
    outputGlossary: {
      'R² (R-squared)': 'A number from 0 to 1 indicating how well the model fits your data. 0.89 means 89% of variation is explained by the model — very good.',
      'Confidence Interval': 'A range that the true future value is likely to fall within. A 95% confidence interval means there\'s a 95% chance the future value lands inside the shaded band.',
      'Holt-Winters': 'A proven mathematical forecasting method that accounts for both trends and seasonal patterns in time-series data.',
      'Forecast Horizon': 'How many future time periods (days, weeks, months) you want to predict ahead.'
    },
    robotExpression: 'celebrate'
  },
  {
    id: 'ml-clusters',
    stepNumber: 10,
    totalSteps: 16,
    title: 'ML Cohort Clustering & Multi-Dimensional Radar Studio',
    category: 'Predictive & ML',
    featureName: 'K-Means++ Unsupervised Segmentation',
    badge: 'ML Segments',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    tab: 'clusters',
    novaQuip: "Here's where machine learning gets really useful — automatically grouping your data into meaningful segments!",
    appContext: 'The ML Segments tab runs unsupervised machine learning to automatically discover natural groupings in your data.',

    // Phase 1
    actionLead:
      'I am navigating to ML Segments to partition data into operational tiers. Watch as I click the ML Segments tab.',
    actionSpeech:
      "Next, let us explore unsupervised machine learning. Watch as I click the ML Segments tab.",
    targetSelector: '[data-tour="tab-clusters"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to ML Segments',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Observe the autonomous K-Means++ clustering results! Data records are partitioned into operational tiers: Tier 1 Champions, Core Volume, and Margin-Sensitive. Look at the multi-dimensional Radar Spider chart comparing normalized attributes across all cohorts (0–100 scale), accompanied by actionable prescriptive recommendations for each tier.',
    outputSpeech:
      "Notice how our records are partitioned into operational tiers like Champions and Core Volume! The multi-dimensional radar spider chart benchmarks normalized metrics across clusters, giving you clear strategic playbooks.",
    keyMetricNotice: 'Partitions: 4 Clusters • Multi-Dimensional Radar Spider Chart',
    strategicValue: 'Automates customer and product segmentation for targeted pricing and retention campaigns.',
    beginnerExplain: 'DATOVA automatically groups your records into segments that have similar behaviors — like grouping customers into "Top Spenders", "Occasional Buyers", and "Bargain Hunters". No manual sorting needed.',
    outputMeaning: 'Each cluster/group is shown with a name, size, and a radar chart comparing it against other groups. Use these segments to personalize marketing, pricing, or product strategies for each group.',
    whatIsSeen: 'Cluster cards showing group names, sizes, and key characteristics. A radar/spider chart compares all clusters across multiple dimensions simultaneously.',
    freshUserTip: '1. DATOVA automatically determines the optimal number of clusters from your data.\n2. Each cluster card shows the size (number of records) and top distinguishing traits.\n3. The radar chart lets you visually compare how different each cluster is from the others.',
    whatToDoNext: 'Click on a cluster card to see the individual records that belong to that group. Use the export button to download the cluster assignments for CRM use.',
    outputGlossary: {
      'Cluster': 'A group of data records that are similar to each other and different from records in other groups.',
      'K-Means++': 'A machine learning algorithm that automatically discovers natural groups in data by minimizing distances between points.',
      'Radar Chart': 'A circular chart with multiple axes radiating from a center point — each axis represents a different metric, and the shape of the polygon shows a cluster\'s profile.',
      'Unsupervised': 'Machine learning that finds patterns without being told what to look for — the AI discovers the groups on its own.'
    },
    robotExpression: 'happy'
  },
  {
    id: 'automl-studio',
    stepNumber: 11,
    totalSteps: 16,
    title: 'Enterprise AutoML Studio: Benchmarking & What-If Inference',
    category: 'Predictive & ML',
    featureName: 'AutoML Model Tournament',
    badge: 'AutoML Studio',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    tab: 'automl',
    novaQuip: "Now the most impressive part — DATOVA trains multiple AI models and picks the best one automatically!",
    appContext: 'The AutoML Studio trains multiple machine learning algorithms on your data, compares them, and lets you make live predictions.',

    // Phase 1
    actionLead:
      'I am navigating to AutoML Studio to benchmark machine learning algorithms. Watch as I click the AutoML Studio tab.',
    actionSpeech:
      "Now, let us explore enterprise Automated Machine Learning. Watch as I click the AutoML Studio tab.",
    targetSelector: '[data-tour="tab-automl"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to AutoML Studio',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Look at the AutoML Tournament! The system inferred the prediction target, trained multiple algorithms (Random Forest, Gradient Boosting, Ridge Regressor, Decision Tree), and crowned the Champion Model based on R² and RMSE. Below is the interactive "What-If" Inference Simulator: move input sliders to simulate live predictions with 95% confidence intervals!',
    outputSpeech:
      "Here is the AutoML Studio! It trained multiple algorithms, crowned the Champion Model, and provides an interactive What-If simulator where moving sliders predicts outcomes in real time!",
    keyMetricNotice: 'Champion Model: Random Forest Ensemble • Permutation Feature Importance',
    strategicValue: 'Deploy predictive ML models without hiring a dedicated data science team.',
    beginnerExplain: 'DATOVA trains multiple AI models on your data and automatically picks the best one — like running a competition between different prediction methods and declaring a winner. You get the results without needing to know any machine learning.',
    outputMeaning: 'The leaderboard shows which prediction model won and how accurate it is. The "What-If Simulator" below lets you ask "what would happen if Sales = X and Discount = Y?" and get an instant AI prediction.',
    whatIsSeen: 'A model leaderboard ranking algorithms by accuracy. Below it, a slider-based simulator where you can adjust input values and see predicted output values update in real time.',
    freshUserTip: '1. Select what you want to predict (e.g., "Sales") from the Target dropdown.\n2. Click "Run AutoML" — DATOVA trains and compares multiple models automatically.\n3. Once done, use the What-If sliders to test different input scenarios and see predicted outcomes.',
    whatToDoNext: 'Try the What-If simulator: move the sliders to different values and watch the predicted output change in real time — this is live AI inference!',
    outputGlossary: {
      'RMSE': 'Root Mean Squared Error — measures how far predictions are from the actual values. Lower = more accurate.',
      'R²': 'How much of the variation in your target is explained by the model. Closer to 1.0 = better.',
      'Random Forest': 'An ensemble of many decision trees that vote together for a final prediction — often the most accurate.',
      'Feature Importance': 'Which input columns have the most influence on the prediction — helps you understand what drives your outcomes.',
      'What-If Simulator': 'An interactive tool where you change input values and instantly see how the model\'s prediction changes.'
    },
    robotExpression: 'celebrate'
  },
  {
    id: 'dataprep-studio',
    stepNumber: 12,
    totalSteps: 16,
    title: 'Autonomous Data Prep & Cleanse Studio',
    category: 'Data Engineering',
    featureName: 'In-Place Data Cleansing',
    badge: 'Data Prep Tab',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    tab: 'dataprep',
    novaQuip: "Real data is messy! Let me show you how to fix all the issues with one click.",
    appContext: 'The Data Prep tab lists every data quality issue found in your dataset and lets you fix them all automatically.',

    // Phase 1
    actionLead:
      'I am navigating to the Data Prep Studio to demonstrate autonomous cleansing. Watch as I click Data Prep in the sidebar.',
    actionSpeech:
      "Let us examine data cleaning. Watch as I click the Data Prep tab in the sidebar.",
    targetSelector: '[data-tour="tab-dataprep"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Data Prep',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'Observe the itemized defect inventory: missing discount rates, whitespace padding, duplicate candidates, and extreme outliers. Clicking "Preview Repair Pipeline" dry-runs median imputation, duplicate removal, and outlier clipping. Clicking "Apply Auto-Cleanse" permanently sanitizes the data in-place, boosting the Health Score to 95+!',
    outputSpeech:
      "In the Data Prep studio, you can see all data defects itemized. The engine can impute missing values, strip whitespace, and eliminate duplicates in place, climbing your health score to 95 plus!",
    keyMetricNotice: 'In-Place Pipeline: Imputation • Deduplication • Outlier Capping',
    strategicValue: 'Saves 80% of data prep time: dirty spreadsheets become pristine, audit-ready data assets in one click.',
    beginnerExplain: 'Real-world data is messy — missing values, typos, duplicates. This feature automatically finds all those problems and fixes them with one click. No Excel formulas, no manual editing.',
    outputMeaning: 'The defect list shows exactly what\'s wrong with your data and how bad it is. "Preview" shows you what the fix will look like before you apply it. "Apply" permanently fixes the data and raises your Health Score.',
    whatIsSeen: 'A list of data issues found (missing values, duplicates, outliers), each with a severity rating. Two buttons: Preview the repair pipeline, or Apply the auto-cleanse to fix everything.',
    freshUserTip: '1. Review the defect list — each item shows what\'s wrong and in which column.\n2. Click "Preview Repair" to see a before/after comparison without changing your data.\n3. Click "Apply Auto-Cleanse" to fix everything permanently and boost your Health Score.',
    whatToDoNext: 'After applying the cleanse, return to the Overview tab to see your Health Score jump to 95+. Then re-run any analysis for more accurate results.',
    outputGlossary: {
      'Imputation': 'Filling in missing values with a calculated replacement (like the column average or median).',
      'Deduplication': 'Removing identical rows that appear more than once in your data.',
      'Outlier Capping': 'Limiting extreme values to a reasonable range instead of removing them entirely.',
      'Whitespace': 'Extra spaces or invisible characters in text columns that can cause mismatches in analysis.'
    },
    robotExpression: 'wink'
  },
  {
    id: 'sql-lab-run',
    stepNumber: 13,
    totalSteps: 16,
    title: 'Natural Language SQL Lab: 5ms In-Memory Execution',
    category: 'Data Engineering',
    featureName: 'English-to-SQL Sandbox',
    badge: 'SQL Lab Tab',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    tab: 'sql',
    novaQuip: "You don't need to know SQL — just ask your question and DATOVA writes and runs the query for you!",
    appContext: 'The SQL Lab lets you query your data using natural language questions or direct SQL — results appear instantly as a table and chart.',

    // Phase 1
    actionLead:
      'I am taking us to the SQL Lab to run a live query. Watch as I click the "Top Aggregates" sample query button to generate and execute ANSI SQL live!',
    actionSpeech:
      "Now for the SQL Lab! Watch as I click a sample query to translate and execute ANSI SQL against our database live!",
    targetSelector: '[data-tour="sql-sample-0"]',
    actionType: 'click',
    pointerLabel: 'Nova Leading: Clicking Sample SQL Query Live',
    actionDelayMs: 2200,

    // Phase 2
    outputBreakdown:
      'Look at the result that just populated in 5 milliseconds! DATOVA translated the question into ANSI SQL: SELECT Category, ROUND(SUM(Revenue), 2) GROUP BY Category. Below, you can toggle between the paginated SQLite results table and an instant visual bar chart, with one-click copy for ANSI SQL and Python Pandas code.',
    outputSpeech:
      "Look at the query output that populated in 5 milliseconds! You can see the generated SQL, the live data table, and an instant visualization, with one-click code export for Python and SQL.",
    keyMetricNotice: 'Execution Latency: 5ms • SQLite Read-Only Safe • Table & Chart Toggle',
    strategicValue: 'Enables non-technical leaders to ask ad-hoc questions and get immediate database answers.',
    beginnerExplain: 'You don\'t need to know SQL to use this. Type a question in plain English like "show me total sales by category" and DATOVA writes the database query for you and shows the results instantly.',
    outputMeaning: 'The result table shows the answer to your question as a data table. The chart button converts it to a visual instantly. You can also copy the SQL code if you want to use it elsewhere.',
    whatIsSeen: 'A query editor area with sample question buttons. Below it, a results table with exact values, and a toggle to switch to a bar chart visualization of the same data.',
    freshUserTip: '1. Click one of the sample query buttons to see an example, or type your own question.\n2. Press the Play button or hit Enter to run the query.\n3. Toggle between "Table" and "Chart" views using the buttons below the results.\n4. Copy the generated SQL with one click if you want to use it in another tool.',
    whatToDoNext: 'Try typing your own question in plain English, like "show me top 5 products by revenue" and see DATOVA write the SQL for you.',
    outputGlossary: {
      'SQL': 'Structured Query Language — the standard language for querying databases. DATOVA writes this for you automatically.',
      'ANSI SQL': 'The universal, standard version of SQL that works across different database systems.',
      'SQLite': 'A lightweight database engine running inside DATOVA — your data is queried here in real time.',
      'Aggregation': 'Combining many rows into a summary value — like SUM, AVG, or COUNT.'
    },
    robotExpression: 'explain'
  },
  {
    id: 'ai-analyst-chat',
    stepNumber: 14,
    totalSteps: 16,
    title: 'ASK DATOVA: AI Conversational Analyst with Voice Dictation',
    category: 'Executive Output',
    featureName: 'Multi-Provider Copilot',
    badge: 'AI Analyst Tab',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    tab: 'chat',
    novaQuip: "This is where you talk directly to your data! Ask any question in plain English — or speak it aloud!",
    appContext: 'The Ask DATOVA tab is a conversational AI analyst — type or speak questions and get answers with embedded charts directly in the chat.',

    // Phase 1
    actionLead:
      'I am navigating to the AI Analyst view to demonstrate our conversational copilot. Watch as I click the AI Analyst tab.',
    actionSpeech:
      "Now meet your conversational AI copilot. Watch as I click on the AI Analyst tab.",
    targetSelector: '[data-tour="tab-chat"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to AI Analyst',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'This is ASK DATOVA! Backed by Google Gemini 2.0 Flash, GPT-4o, Claude 3.5 Sonnet, or local Ollama. Notice the microphone button for speech-to-text dictation. ASK DATOVA does not just chat: asking it to "forecast revenue" or "cluster customers" triggers real workspace actions and renders interactive visual components directly in the conversation!',
    outputSpeech:
      "This is ASK DATOVA! You can type or click the microphone to speak questions aloud. ASK DATOVA executes live workspace actions, generating charts, forecasts, and clusters right inside your conversation.",
    keyMetricNotice: 'Gemini 2.0 Flash / GPT-4o / Claude • Voice Dictation • Live Action Triggers',
    strategicValue: 'Turn data analysis into a seamless dialogue: speak your questions and let AI drive the analysis.',
    beginnerExplain: 'Talk to your data like you\'re talking to a smart analyst. Type or speak questions like "Which products are most profitable?" or "Show me a sales forecast" — and DATOVA answers with real charts and numbers from your actual data.',
    outputMeaning: 'The AI doesn\'t just answer in text — it can generate live charts, run forecasts, and create analyses right in the chat. Click the mic button to speak your question instead of typing.',
    whatIsSeen: 'A chat interface where you type questions. The AI responds with text explanations plus interactive charts and tables embedded directly in the conversation.',
    freshUserTip: '1. Type any question about your data in the input box and press Send.\n2. Click the microphone button to dictate your question by voice.\n3. If the AI generates a chart in its response, hover over it to see exact values.\n4. Ask follow-up questions — DATOVA remembers the context of your conversation.',
    whatToDoNext: 'Try asking: "What are the top 3 revenue drivers in my dataset?" or "Show me a trend forecast for the next 6 months".',
    outputGlossary: {
      'LLM': 'Large Language Model — the AI behind natural language understanding (e.g., Gemini, GPT-4o, Claude).',
      'Voice Dictation': 'Speaking your question aloud instead of typing — the AI transcribes and processes your spoken words.',
      'Context Window': 'The conversation history the AI remembers — it uses previous messages to give more relevant answers.',
      'Action Trigger': 'When the AI performs an actual workspace operation (like running a forecast) in response to your question.'
    },
    robotExpression: 'celebrate'
  },
  {
    id: 'executive-report-audio',
    stepNumber: 15,
    totalSteps: 16,
    title: 'Executive Briefing, Presentation Slides & Audio Podcast',
    category: 'Executive Output',
    featureName: 'Executive Reporting Suite',
    badge: 'Report & Topbar',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    tab: 'report',
    novaQuip: "Time to impress the boardroom! Let me show you how to export everything into professional deliverables.",
    appContext: 'The Report tab generates publication-ready PDF reports, Excel workbooks, slide decks, and spoken audio briefings from your analysis.',

    // Phase 1
    actionLead:
      'I am navigating to the Executive Report to show executive deliverable generation. Watch as I click the Executive Report tab.',
    actionSpeech:
      "Let us examine executive deliverables. Watch as I click on the Executive Report tab in the sidebar.",
    targetSelector: '[data-tour="tab-report"]',
    actionType: 'click',
    pointerLabel: 'Nova Navigating: Switching to Executive Report',
    actionDelayMs: 1800,

    // Phase 2
    outputBreakdown:
      'This is the Executive Deliverable Suite! You can export vector-quality styled PDF briefings and multi-tab Excel workbooks with one click. Click "Present" to launch a full-screen C-Suite presentation slide deck with arrow key navigation, or click "Audio Brief" in the top bar to hear a 60-second synthesized executive podcast briefing!',
    outputSpeech:
      "Here is the Executive Deliverable Suite! You can export publication-ready PDFs, Excel workbooks, present full-screen slide decks, and listen to a synthesized executive audio podcast briefing.",
    keyMetricNotice: 'Vector PDF • Excel Workbook • Fullscreen Presentation • 60s Audio Podcast',
    strategicValue: 'Eliminate hours spent assembling slides and formatting reports before every leadership meeting.',
    beginnerExplain: 'Everything you\'ve analyzed can be exported into professional boardroom-ready formats — a styled PDF report, an Excel file with all your data, a PowerPoint-style presentation, or even an audio podcast summary you can listen to on the go.',
    outputMeaning: 'The Export button creates a polished PDF report. The Present button launches a fullscreen slide deck. The Audio Brief (top bar "···" menu) generates a 60-second spoken summary of your dataset\'s key findings.',
    whatIsSeen: 'Export and Present buttons that generate professional deliverables. A preview of the executive report with charts, KPIs, and insights formatted for leadership audiences.',
    freshUserTip: '1. Click "Export PDF" to download a formatted report with your charts and insights.\n2. Click "Export Excel" to get all your data and analysis in a spreadsheet.\n3. Click "Present" to launch a fullscreen slide deck navigable with arrow keys.\n4. Find "Audio Brief" in the top bar menu to generate a spoken podcast summary.',
    whatToDoNext: 'Click "Present" to see your analysis in fullscreen slide format — use arrow keys to navigate between slides.',
    outputGlossary: {
      'Vector PDF': 'A PDF where charts and text remain crisp at any zoom level — ideal for printing and presentations.',
      'Executive Briefing': 'A concise summary of key findings formatted for leadership audiences.',
      'Audio Podcast': 'A spoken, synthesized audio file summarizing your dataset\'s insights — like a news briefing for your data.',
      'Slide Deck': 'A presentation with multiple slides, similar to PowerPoint but auto-generated from your analysis.'
    },
    robotExpression: 'wave'
  },
  {
    id: 'tour-complete',
    stepNumber: 16,
    totalSteps: 16,
    title: 'Tour Complete: You Have Mastered DATOVA AI!',
    category: 'Graduation',
    featureName: 'Mastery Complete',
    badge: 'Certified Master',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    novaQuip: "You did it!! You've seen everything DATOVA AI can do. You're ready to unleash it on your own data!",
    appContext: 'You have completed the full 16-feature tour of DATOVA AI and are now ready to use it with your own data.',

    // Phase 1
    actionLead:
      'You have witnessed all 16 autonomous features of DATOVA AI running live and practical on real data! I will now celebrate our completion.',
    actionSpeech:
      "Congratulations! You have witnessed all 16 features of DATOVA AI executed live and practical on real data!",
    pointerLabel: 'Nova Celebrating: Full Project Tour Complete!',
    actionDelayMs: 1000,

    // Phase 2
    outputBreakdown:
      'You are now fully prepared to upload your own enterprise datasets (CSV, XLSX, TSV, ZIP) or test additional domain samples (HR Workforce, Commercial Banking, Academic Performance). I will remain available via the "3D Robot Tour" button in the top right corner anytime you want to revisit a feature!',
    outputSpeech:
      "You are now ready to upload your own data or explore other domain datasets. I will be right here in the top corner whenever you need guidance. Happy discovering!",
    keyMetricNotice: '16/16 Features Mastered • 100% Deterministic • Ready for Your Data',
    strategicValue: 'From raw data to board-ready insights and machine learning in minutes.',
    beginnerExplain: 'You\'ve just seen the entire DATOVA platform from end to end. You\'re ready to use it with your own data. Just click "Ingest" in the top bar to upload your own CSV or Excel file and the AI will analyze it the same way.',
    outputMeaning: 'You now know what every feature does and how to read every output. Start by clicking "Ingest" to upload your own data. I\'ll be here to guide you anytime via the "3D Tour" button.',
    whatIsSeen: 'A completion screen with Nova celebrating and a summary of all 16 features you\'ve explored. Quick-start buttons to upload your own data or explore other sample datasets.',
    freshUserTip: '1. Click "Upload My Data" to start analyzing your own CSV or Excel file.\n2. Or try another sample dataset (HR, Banking, Academic) to explore different domain types.\n3. Come back to this tutorial anytime via the "3D Tour" button in the top navigation bar.',
    whatToDoNext: 'Upload your own data file using the "Ingest" button in the top bar — DATOVA will automatically detect its domain and prepare all analyses.',
    outputGlossary: {
      'CSV': 'Comma-Separated Values — a simple spreadsheet format. Most export tools (Excel, Google Sheets) can save as CSV.',
      'XLSX': 'Microsoft Excel file format — DATOVA can read multi-sheet Excel files directly.',
      'Domain Sample': 'Pre-built example datasets for different industries — great for exploring DATOVA features without your own data.'
    },
    robotExpression: 'celebrate'
  }
];
