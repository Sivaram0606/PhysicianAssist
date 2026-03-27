# **PhenoFlow: Automated Clinical Narrative & Phenotyping Engine**

**PhenoFlow** is a high-performance clinical automation pipeline designed to bridge the gap between structured registry data and professional medical documentation. Built on **Google Cloud Vertex AI**, it transforms complex patient data into validated, peer-reviewed clinical narratives in seconds.

---

## **🌟 Purpose**
Modern medicine is data-rich but narrative-driven. Clinicians often spend hours manually synthesizing raw JSON registry data into readable History of Present Illness (HPI) or Review of Systems (ROS) sections. **PhenoFlow** automates this synthesis while providing an interactive, "Trust but Verify" audit trail for every claim generated.

---

## **🚀 Key Features**

### **1. Parallelized Clinical Synthesis**
Unlike traditional LLM wrappers that generate text sequentially, PhenoFlow utilizes a **High-Concurrency Architecture**. Powered by `asyncio.gather` and **Gemini 2.5 Flash**, the system triggers generation for 8+ clinical sections simultaneously.
* **Impact:** Total generation time is slashed from **30+ seconds to under 4 seconds**.

### **2. Deep-Link Traceability (Grounding)**
PhenoFlow solves the "Black Box" problem of AI. Every clinical claim is cross-referenced against the source patient record via **Google Discovery Engine**. 
* **Interactive Citations:** Clicking a citation (e.g., `[*]`) in the narrative instantly highlights the corresponding raw data field in the UI sidebar.
* **Refiner Logic:** A secondary LLM layer ensures that clinical scores (e.g., MIDAS, PROMIS) are mapped to their specific interpreted meanings.

### **3. Automated AI Audit (LLM-as-a-Judge)**
Upon generation, PhenoFlow triggers an independent **Vertex AI EvalTask** that audits the narrative using objective metrics:
* **Groundedness:** Verifying claims against source facts.
* **Coherence & Fluency:** Ensuring professional medical standards.
* **Safety:** Detecting clinical discrepancies before human review.



### **4. Clinical Trust Dashboard**
A high-contrast quality dashboard provides clinicians with immediate visual feedback:
* **Confidence Verdict:** A mean groundedness score across all audited sections.
* **Section Performance:** A breakdown of which sections are highly verified vs. those requiring manual oversight.

---

## **💼 Business Value**

* **Clinical Throughput**: Reduces documentation time from **20 minutes to under 10 seconds** per note. This maximizes patient volume while directly combating clinician burnout.
* **Revenue Optimization**: High-fidelity narratives lead to precise coding and fewer insurance denials by ensuring markers like MIDAS or PROMIS scores are documented correctly.
* **Risk Management**: The **AI Audit** acts as a first-line defense against hallucinations, creating a transparent, auditable trail for AI-assisted workflows.
* **Standardization**: Guarantees a consistent, professional tone across the entire department, regardless of the individual provider on shift.

---

## **⚙️ Technical Value**

* **High-Concurrency**: Utilizes Python’s `asyncio` to turn linear API wait times into a single parallel "burst."
* **Trust but Verify Pattern**: Implements a dual-model approach where one model generates and a second, independent task audits for accuracy.
* **Traceable Grounding**: Integrates **Discovery Engine** to provide verifiable links between unstructured text and structured JSON source data.
* **Cloud-Native & Serverless**: Designed for **Google Cloud (App Engine/Cloud Run)**; scales to zero cost when idle and handles massive spikes in registry processing demand.

---

## **🗺️ Future Roadmap**

* **📄 Seamless Export:** One-click PDF generation and secure referral document creation.
* **🏥 EHR Integration:** Native HL7 FHIR support for direct "Write-Back" into Epic, Cerner, and AthenaHealth.
* **🕒 Longitudinal Analysis:** Comparing narratives across multiple visits to track treatment efficacy and phenotypic drift.
* **🎙️ Ambient Scribe Mode:** Real-time bedside voice-to-narrative updates for rounding physicians.

---

## **📦 Local Development Setup**

### **1. Prerequisites**
* **Python 3.10+** and **Node.js 18+**
* **Google Cloud CLI** authenticated to a project with Vertex AI and Discovery Engine APIs enabled.

### **2. Authentication**
```bash
gcloud auth application-default login
gcloud config set project [YOUR_PROJECT_ID]
```
### **3. Backend (FastAPI)**
```bash
# From project root
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```
### **4. Frontend (React)**
```bash
# From project root
Uncomment the portion for local running in vite.config.js file
cd demo/ui
npm install
npm run dev
```
### ☁️ Deployment to App Engine
* **1. Build the Frontend**
```bash
cd demo/ui
npm run build
```     
* **2. Deploy**
```bash
gcloud app deploy
```

### Vision: PhenoFlow is designed to empower clinicians with AI that is not only fast but demonstrably grounded in truth.
