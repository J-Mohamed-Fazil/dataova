# DATOVA AI
> **"Upload. Ask. Discover. Decide."**  
> *Universal, Domain-Agnostic AI Data Analyst*

---

## 🌟 Overview

**DATOVA AI** is an enterprise-grade, full-stack AI data analytics platform. It automatically ingests raw tabular datasets (`CSV`, `XLSX`, `TSV`, or multi-file archives), profiles schemas, evaluates data health (0–100 score), infers domain context (Retail, HR, Banking, Education, Logistics, Healthcare, SaaS), discovers key metrics, detects statistical anomalies (IQR & Z-score), generates explainable strategic insights, constructs interactive multi-sheet dashboards, provides an intelligent conversational assistant (**ASK DATOVA**) with workspace actions, and compiles an editable executive briefing exportable to styled PDF and Excel.

---

## 🏗️ Technical Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts
- **Backend**: Python 3.14 + FastAPI + Uvicorn + Pydantic v2
- **Data Engine**: Pandas + NumPy (100% deterministic calculations — zero fabricated numbers)
- **Database**: SQLAlchemy 2.0 (SQLite for local run, PostgreSQL-ready)
- **Reporting Engine**: ReportLab (vector-quality PDF) + OpenPyXL (Excel workbooks)
- **AI Orchestration**: Provider abstraction supporting OpenAI GPT-4o, Google Gemini, and a built-in deterministic offline reasoning engine.

---

## 🚀 How to Open and Run in VS Code (Step-by-Step)

### Step 1: Open the Project Folder in VS Code
1. Launch **Visual Studio Code**.
2. Click **File > Open Folder...** (or press `Ctrl + K, Ctrl + O`).
3. Select the directory:
   ```
   D:\datanova
   ```

---

### Step 2: Open Integrated Terminals in VS Code
You will need two terminals in VS Code: one for the **Backend** and one for the **Frontend**.

#### Terminal 1 (Backend - FastAPI):
1. Open a new terminal in VS Code: press `Ctrl + Shift + \`` or go to **Terminal > New Terminal**.
2. Run:
   ```powershell
   cd d:\datanova\backend
   python run.py
   ```
3. You will see:
   ```
   INFO: Uvicorn running on http://0.0.0.0:8000
   [INFO] datova: Initializing DATOVA AI Database and Schemas...
   [INFO] datova: DATOVA AI Engine Ready.
   ```
   *(Backend is now running on port 8000)*

---

#### Terminal 2 (Frontend - React + Vite):
1. Split or open a second terminal: click the **`+`** icon or split icon in the terminal panel.
2. Run:
   ```powershell
   $env:Path = "C:\Users\Mohamed Fazil J\AppData\Local\OpenAI\Codex\runtimes\cua_node\23828fd353da361d\bin;" + $env:Path
   cd d:\datanova\frontend
   npm.cmd run dev
   ```
3. You will see:
   ```
     VITE v5.4.21 ready in 510 ms

     ➜  Local:   http://localhost:5173/
     ➜  Network: http://172.20.10.2:5173/
   ```
   *(Frontend is now live on port 5173)*

---

### Step 3: Open in Browser
Open your browser and navigate to:
```
http://localhost:5173/
```

---

### ⚡ Alternative Method: One-Click Launchers

If you prefer not to type terminal commands, simply double-click the included batch scripts in File Explorer or run them from VS Code:

- **`start_all.bat`**: Launches both Backend and Frontend in separate windows and automatically opens your browser at `http://localhost:5173/`.
- **`start_backend.bat`**: Launches only the FastAPI backend on port 8000.
- **`start_frontend.bat`**: Launches only the Vite frontend on port 5173.

---

### 🛠️ Alternative Method: VS Code Run & Debug (F5)

1. In VS Code, click the **Run & Debug** icon on the left activity bar (or press `Ctrl + Shift + D`).
2. Select **"FastAPI: Run DATOVA Backend"** or **"DATOVA Fullstack"** from the top dropdown.
3. Press **F5** to start.

---

## 🎯 How to Use DATOVA AI (Full Feature Walkthrough)

### 1. Landing Page & Quick-Start Datasets
- Open `http://localhost:5173/`.
- You will see the hero tagline: *"Your data has a story. Let AI find it."*
- Click **"Upload Your Data"** to drop any CSV or XLSX file, **OR**
- Click **"Load Sample"** on any pre-packaged domain dataset:
  - 🛒 **Global Retail & E-Commerce Sales** (`retail_sales.csv`)
  - 👥 **Corporate Workforce & Attrition** (`hr_workforce.csv`)
  - 🏛️ **Commercial Banking Transactions** (`banking_transactions.csv`)
  - 🎓 **Academic Student Performance** (`student_performance.csv`)

### 2. Overview View
- **Domain Badge**: Automatically detects the domain context and gives confidence (e.g. 96% Retail & E-Commerce).
- **Data Health Score**: 0–100 score auditing null cells, duplicate rows, and schema integrity.
- **Dynamic KPIs**: Discovered metrics with **"Explain"** buttons revealing the exact calculation formula (*"How was this calculated?"*) and business impact (*"Why does this matter?"*).

### 3. Data View
- **Raw Preview**: Paginated preview of the dataset records.
- **Profiling**: Inferred semantic types (Numeric, DateTime, Boolean, Categorical, Identifier), missing rates, cardinality, min/max/mean/std, and sample values.
- **Health Audit**: Defect itemization and remediation suggestions.
- **Relationships**: Visualizes detected cross-table join keys with confidence and 1-to-many cardinality.

### 4. Interactive Dashboard & Chart Editor
- **Multi-Sheet Navigation**: Switch between sheets (*"Overview"*, *"Segment Deep Dive"*, or click **"+ New Sheet"**).
- **Interactive Charts**: Rendered with Recharts (Bar, Line, Pie, Scatter, Table).
- **In-Place Chart Editor**: Click the **Pencil icon** on any chart to:
  - Switch chart type (e.g. from Bar to Line or Pie)
  - Change X-axis or Y-axis columns
  - Change aggregation mode (`SUM`, `AVG`, `MIN`, `MAX`, `COUNT`)
  - Toggle half-width vs full-width
  - Changes update and re-render instantly without refreshing!

### 5. AI Predictive Forecasting Studio (v2.0 Enterprise)
- Click **Predictive Studio** in the left sidebar.
- Run time-series forecasts across 3, 6, 12, or 24 periods with Holt-Winters linear trend exponential smoothing.
- Toggle **95% Confidence Interval bands** and scenario projections (**Baseline**, **Bull +15%**, **Bear -15%**).
- Review telemetry: Projected Target, Trend Trajectory (e.g. *Accelerating Expansion*), and Model Reliability score (R²).

### 6. ML Cohort Clustering & Radar Studio (v2.0 Enterprise)
- Click **ML Segments** in the left sidebar.
- Autonomous K-Means++ clustering partitions records into 2-5 distinct operational tiers (*Tier 1 Champions*, *Core Volume*, *Margin-Sensitive*, *At-Risk*).
- Interactive multi-dimensional **Radar / Spider chart** comparing cluster profiles across normalized metrics (0–100 scale).
- Actionable prescriptive recommendations generated for each cohort.

### 7. Autonomous Data Prep & Cleanse Studio (v2.0 Enterprise)
- Click **Data Prep** in the left sidebar.
- Review itemized defect audit: null counts, duplicate rows, whitespace padding, and extreme IQR outliers.
- Click **"Preview Repair Pipeline"** to dry-run best-practice transformations.
- Click **"Apply Auto-Cleanse"** to permanently repair the dataset in-place and watch the Data Health Score climb to 95+!
- Click **"Download Cleaned CSV"** to export sanitized data.

### 8. Enterprise Automated Machine Learning (AutoML Studio v3.0)
- Click **AutoML Studio** in the left sidebar.
- **Autonomous Task Detection**: Automatically infers Classification vs. Regression based on target cardinality and data distribution.
- **Multi-Algorithm Benchmarking**: Vectorized competition across Decision Trees, Regularized Ensembles (Ridge & Logistic L2), Random Forest Ensembles, and Gradient Boosting.
- **Model Leaderboard**: Ranks models by Accuracy, F1 Score, R² Fit, RMSE, and inference latency, crowning the **Champion Model**.
- **Feature Importance Ranking**: Permutation sensitivity bars quantify the exact leverage each feature exerts on target outcomes.
- **Interactive 'What-If' Inference Simulator**: Tweak input sliders and dropdowns in real time to simulate live model predictions with 95% confidence intervals and probability scores.
- **Pareto 80/20 & Multivariate OLS Regression**: Deep-dive sub-tabs analyzing the 'Vital Few' category entities with Gini inequality indices and econometric regression with statistical p-values ($p < 0.05$).

### 9. Natural Language SQL Lab & Python Sandbox (v2.0 Enterprise)
- Click **SQL Lab** in the left sidebar.
- Type business questions in plain English (*"Show top 5 categories by total revenue"*) and click **"Translate & Run"**.
- View auto-generated ANSI SQL and Python / Pandas code snippets with copy-to-clipboard.
- Run safe, read-only SQL queries in milliseconds against live in-memory SQLite tables.
- Toggle between interactive Data Table and instant Data Visualization!

### 10. "ASK DATOVA" Conversational AI Analyst with Voice Dictation
- Click **AI Analyst** in the left sidebar.
- Next-Gen Multi-Provider Support: Powered by Google Gemini 2.0 Flash (`gemini-2.0-flash`), Gemini 1.5 Pro, OpenAI GPT-4o / o3-mini, DeepSeek-R1 / V3, Anthropic Claude 3.5 Sonnet, or local Ollama.
- Click the **Microphone icon** to speak questions aloud using Web Speech API voice dictation.
- Type or speak analytical queries:
  - *"Forecast sales for the next 6 months"* -> AI renders interactive forecast line chart and scenario matrix!
  - *"Segment customers into clusters"* -> AI renders cohort distributions and strategic actions!
  - *"Train a predictive model for attrition"* -> AI launches AutoML Studio!

### 11. Executive Report, Presentation Deck & Audio Briefing (v2.0 Enterprise)
- Click **Report** in the left sidebar.
- Click **"Listen"** to play a synthesized voice executive audio briefing using browser speech synthesis.
- Click **"Present"** to launch a full-screen, presentation-ready C-Suite slide deck with keyboard navigation (`←`, `→`, `Space`, `Esc`).
- Click **"Export PDF"** or **"Export Excel"** for publication-ready deliverables.

### 12. Settings & Next-Gen AI Provider Configuration
- Configure Gemini 2.0 Flash, OpenAI, DeepSeek, Anthropic, or Ollama credentials.
- High-Performance Database: Backed by SQLite Write-Ahead Logging (WAL mode), 64MB memory page cache, and 10s busy timeout resilience.

---

## 🧪 Automated Testing

To run the full automated backend test suite:
```powershell
cd d:\datanova\backend
python -m pytest
```
All 33 automated tests verify:
- Enterprise AutoML classification and regression training, benchmarking, and real-time inference.
- Pareto 80/20 cumulative distribution, vital few identification, and Gini coefficient.
- Multivariate OLS linear regression, R² goodness of fit, and p-value statistical significance.
- Time-series forecasting algorithms, confidence bounds, and scenario calculations.
- Vectorized K-Means clustering, centroid normalization, and cohort classification.
- Autonomous data cleanse pipelines, duplicate removal, null imputation, and health scoring.
- In-memory SQLite execution, Natural Language to SQL translation, PDF/Excel export, and dynamic reporting.

