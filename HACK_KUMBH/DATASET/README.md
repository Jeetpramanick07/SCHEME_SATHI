# Welfare Scheme Datasets - Central + Maharashtra/Vidarbha (built 19-Nov-2026)

Source: your uploaded myScheme-derived CSVs (4,670 all-India schemes -> filtered to **649 Central + 84 Maharashtra**), 51k FAQs,
curated Vidarbha JSON/XLSX (24 verified records, 18-document master, 6 help centres, 11 districts).

## Files
| File | What it is |
|---|---|
| `central_schemes_master.csv` / `central_schemes_dataset.xlsx` | **649 Central schemes**, one row each. Workbook adds Required_Documents (long), Application_Steps (long), FAQs, Document_Master (EN/HI/MR), Quality_Report, Data_Dictionary |
| `maharashtra_vidarbha_schemes_master.csv` / `maharashtra_vidarbha_schemes_dataset.xlsx` | **90 Maharashtra schemes** (84 state + 6 curated Vidarbha/Nagpur/Gadchiroli-only records). Workbook adds Eligibility_Rules (machine-readable), Scheme_District_Mapping (11 Vidarbha districts), Help_Centres, Vidarbha_Districts, Document_Master, FAQs, Quality_Report |
| `central_scheme_faqs.csv`, `maharashtra_scheme_faqs.csv` | Cleaned, de-duplicated FAQs keyed by `scheme_id` |
| `eligibility_rules_structured_vidarbha.csv` | Operator-based rules (age, income, gender...) for the 24 curated schemes - plug into the questionnaire engine |
| `vidarbha_scheme_district_mapping.csv` | Scheme x district rows for the admin dashboard |

## Trust model (read before demo)
Every row has `how_to_apply_source`, `documents_source`, `data_confidence`, `needs_verification`, `field_provenance`.
- `SOURCE` / `CURATED_VERIFIED_2026-11-19` - from your data.
- `RESEARCH_OVERRIDE_VERIFY` - 24 flagship Central schemes I rewrote (PM-KISAN, PMAY-U/G, PMUY, PMJJBY, PMSBY, NSAP pensions, DAY-NRLM, JJM, KCC, JSSK, SUMAN, SCSS, POMIS, PM-GKAY, Pahal, 181, NSIGSE, PMKVY, PMMSY, SBM-U). Only PMAY-U 2.0 was checked against live web results; the rest come from scheme guidelines as I know them - confirm on the official portal.
- `DERIVED_FROM_ELIGIBILITY_VERIFY` / `GENERIC_TEMPLATE_VERIFY` - inferred checklist / placeholder steps. Do not present as official.
- `age_min/age_max/income_limit_annual_inr/gender/caste/flags` are rule-extracted from eligibility text (heuristic). Always show the original `eligibility` text too.
- Hindi/Marathi names exist only for curated records; translate the rest in-app.
- Help centres: 6 verified + 9 district-collectorate stubs (website only, no phone/address).
