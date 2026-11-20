export interface RejectionReasonItem {
  code: string;
  text: {
    en: string;
    hi: string;
    mr: string;
  };
  mapped_attribute?: string | null;
}

export const REJECTION_REASONS: RejectionReasonItem[] = [
  {
    code: "INCOME_EXCEEDED",
    text: {
      en: "Household annual income exceeds the maximum limit set by the government scheme guidelines.",
      hi: "पारिवारिक वार्षिक आय सरकारी योजना दिशानिर्देशों द्वारा निर्धारित अधिकतम सीमा से अधिक है।",
      mr: "कुटुंबाचे वार्षिक उत्पन्न सरकारी योजनेच्या नियमांतर्गत निश्चित केलेल्या कमाल मर्यादेपेक्षा जास्त आहे.",
    },
    mapped_attribute: "annual_family_income",
  },
  {
    code: "AGE_OUT_OF_RANGE",
    text: {
      en: "Applicant age does not fall within the eligible minimum and maximum age criteria.",
      hi: "आवेदक की आयु पात्र न्यूनतम और अधिकतम आयु मानदंड के भीतर नहीं आती है।",
      mr: "अर्जदाराचे वय पात्रतेच्या किमान किंवा कमाल वयोमर्यादेत बसत नाही.",
    },
    mapped_attribute: "age",
  },
  {
    code: "DOCUMENT_MISSING",
    text: {
      en: "Mandatory supporting verification document was missing or could not be validated.",
      hi: "अनिवार्य सहायक सत्यापन दस्तावेज गायब था या मान्य नहीं किया जा सका।",
      mr: "आवश्यक कागदपत्र अपूर्ण होते किंवा पडताळणी होऊ शकली नाही.",
    },
    mapped_attribute: "documents",
  },
  {
    code: "OUTSIDE_JURISDICTION",
    text: {
      en: "Applicant does not reside within the notified implementing state, district, or municipal corporation.",
      hi: "आवेदक अधिसूचित क्रियान्वयन राज्य, जिले या नगर निगम सीमा में निवास नहीं करता है।",
      mr: "अर्जदार योजनेच्या अधिसूचित राज्य, जिल्हा किंवा महानगरपालिका क्षेत्रात वास्तव्यास नाही.",
    },
    mapped_attribute: "district",
  },
  {
    code: "LAND_CEILING_EXCEEDED",
    text: {
      en: "Agricultural landholding exceeds the maximum ceiling defined for marginal/small farmers.",
      hi: "कृषि भूमि की जोत सीमांत/छोटे किसानों के लिए निर्धारित अधिकतम सीमा से अधिक है।",
      mr: "शेतजमीन धारणा अल्प किंवा अत्यल्प भूधारक शेतकऱ्यांसाठी ठरवलेल्या कमाल मर्यादेपेक्षा जास्त आहे.",
    },
    mapped_attribute: "landholding_hectares",
  },
  {
    code: "CASTE_MISMATCH",
    text: {
      en: "Applicant caste category is not covered under this specific targeted community scheme.",
      hi: "आवेदक की जाति श्रेणी इस विशिष्ट लक्षित समुदाय योजना के अंतर्गत शामिल नहीं है।",
      mr: "अर्जदाराचा जात प्रवर्ग या विशिष्ट लक्ष्यित समुदाय योजनेच्या निकषात बसत नाही.",
    },
    mapped_attribute: "caste_category",
  },
  {
    code: "SCHEME_EXHAUSTED",
    text: {
      en: "Scheme annual physical beneficiary quota or fiscal budgetary allocation for the district is fully exhausted.",
      hi: "जिले के लिए योजना का वार्षिक भौतिक लाभार्थी कोटा या वित्तीय बजटीय आवंटन पूर्णतः समाप्त हो चुका है।",
      mr: "जिल्ह्यासाठी योजनेचा वार्षिक लाभार्थी कोटा किंवा आर्थिक निधी पूर्णपणे संपला आहे.",
    },
    mapped_attribute: null,
  },
];
