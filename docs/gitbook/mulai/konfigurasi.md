---
description: Semua environment variable yang dibaca Aduin.
icon: sliders
---

# Konfigurasi .env

Semua nilai di bawah adalah placeholder. Jangan commit `.env.local`.

{% code title=".env.local" %}
```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Langflow
LANGFLOW_BASE_URL=http://127.0.0.1:7860
LANGFLOW_API_KEY=<langflow-api-key>
LANGFLOW_FLOW_CLARIFY_ID=<uuid>
LANGFLOW_FLOW_TRIAGE_ID=<uuid>
LANGFLOW_FLOW_EMBED_ID=<uuid>
LANGFLOW_FLOW_OPD_AGENT_ID=<uuid>
LANGFLOW_FLOW_VERIFY_ID=<uuid>
LANGFLOW_FLOW_ALERT_SUMMARY_ID=<uuid>

# Embedding & clustering
EMBEDDING_DIMENSION=768
CLUSTER_SIMILARITY_THRESHOLD=0.75
CLUSTER_RADIUS_METERS=500
CLUSTER_WINDOW_DAYS=14

# Early warning
ALERT_THRESHOLD_Z=2.0
ALERT_MIN_COUNT=3
LANGFLOW_ALERT_TIMEOUT_MS=10000

# Mode demo
NEXT_PUBLIC_DEMO_MODE=true
DEMO_SEED_PASSWORD=<kata-sandi-akun-demo>
```
{% endcode %}

## Penjelasan

| Variabel | Fungsi |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Hanya dipakai di server (route handler dan script seed). |
| `LANGFLOW_FLOW_*_ID` | Satu UUID per flow. Lihat [Flow AI di Langflow](../arsitektur/langflow.md). |
| `EMBEDDING_DIMENSION` | Harus sama dengan model embedding (`granite-embedding-278m-multilingual` = 768). |
| `CLUSTER_*` | Ambang kemiripan, radius, dan jendela waktu clustering. |
| `ALERT_*` | Ambang z-score dan jumlah minimum aduan untuk peringatan dini. |
| `NEXT_PUBLIC_DEMO_MODE` | Mengaktifkan tombol masuk per peran, RoleSwitcher, dan tombol Reset Demo. |

{% hint style="danger" %}
* `NEXT_PUBLIC_DEMO_MODE` **wajib `false`** di production.
* `DEMO_SEED_PASSWORD` hanya dibaca server. Jangan pernah jadikan variabel `NEXT_PUBLIC_*`, dan hindari karakter `$` di dalamnya.
* Kredensial watsonx.ai **tidak** disimpan di `.env.local`, melainkan di Global Variables Langflow.
{% endhint %}
