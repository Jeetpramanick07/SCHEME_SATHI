export interface LocalizedMessage {
  en: string;
  hi: string;
  mr: string;
  review_status: "machine_drafted" | "reviewed";
}

export const DECLARATION_MESSAGES: Record<string, LocalizedMessage> = {
  "declaration.true_information": {
    en: "I confirm the information I gave is true to the best of my knowledge",
    hi: "मैं पुष्टि करता/करती हूँ कि मेरे द्वारा दी गई जानकारी मेरे सर्वोत्तम ज्ञान के अनुसार सत्य है",
    mr: "मी पुष्टी करतो/करते की मी दिलेली माहिती माझ्या माहितीनुसार खरी आणि अचूक आहे",
    review_status: "machine_drafted",
  },
  "declaration.suggestion_only": {
    en: "This tool only suggests schemes from my answers and does not verify them",
    hi: "यह उपकरण केवल मेरे उत्तरों के आधार पर संभावित योजनाओं का सुझाव देता है और उनका सत्यापन नहीं करता है",
    mr: "हे साधन केवळ माझ्या उत्तरांवर आधारित संभाव्य योजना सुचवते आणि त्यांची कोणतीही पडताळणी करत नाही",
    review_status: "machine_drafted",
  },
  "declaration.govt_verification": {
    en: "Government authorities will verify my original documents during application",
    hi: "सरकारी अधिकारी आवेदन के दौरान मेरे मूल दस्तावेजों का सत्यापन करेंगे",
    mr: "अर्ज प्रक्रियेदरम्यान संबंधित शासकीय अधिकारी माझ्या मूळ कागदपत्रांची तपासणी व पडताळणी करतील",
    review_status: "machine_drafted",
  },
  "consent.data_processing": {
    en: "I consent to SchemeSaathi processing my self-declared answers to check scheme eligibility",
    hi: "मैं योजना पात्रता जांचने हेतु अपने स्व-घोषित उत्तरों को प्रोसेस करने की सहमति देता/देती हूँ",
    mr: "योजनेची पात्रता तपासण्यासाठी माझ्या स्वयंघोषित उत्तरांवर प्रक्रिया करण्यास माझी संमती आहे",
    review_status: "machine_drafted",
  },
  "consent.sms_reminders": {
    en: "I consent to receiving SMS reminders for scheme application deadlines and document renewals",
    hi: "मैं योजना की समय-सीमा और दस्तावेज नवीनीकरण के एसएमएस अनुस्मारक प्राप्त करने की सहमति देता/देती हूँ",
    mr: "योजनांच्या अंतिम मुदती आणि कागदपत्र नूतनीकरणाचे एसएमएस स्मरणपत्रे मिळण्यास माझी संमती आहे",
    review_status: "machine_drafted",
  },
  "consent.volunteer_assist": {
    en: "I authorize an accredited volunteer to assist me in filling out my profile and understanding schemes",
    hi: "मैं एक अधिकृत स्वयंसेवक को मेरी प्रोफाइल भरने और योजनाओं को समझने में सहायता करने की अनुमति देता/देती हूँ",
    mr: "माझे प्रोफाईल भरण्यासाठी आणि योजना समजून घेण्यासाठी अधिकृत स्वयंसेवकाची मदत घेण्यास मी अधिकृत करतो/करते",
    review_status: "machine_drafted",
  },
  "disclaimer.rules_subject_to_govt_change": {
    en: "Scheme guidelines, income ceilings, and budgetary allocations are subject to government updates and amendments.",
    hi: "योजना दिशानिर्देश, आय सीमाएं और बजटीय आवंटन सरकारी संशोधनों और अद्यतनों के अधीन हैं।",
    mr: "योजनांची मार्गदर्शक तत्त्वे, उत्पन्नाची मर्यादा आणि आर्थिक तरतूद ही शासकीय बदलांच्या अधीन आहेत.",
    review_status: "machine_drafted",
  },
  "disclaimer.final_decision_with_authority": {
    en: "Final eligibility determination and benefit disbursal rest solely with the competent government department.",
    hi: "अंतिम पात्रता निर्धारण और लाभ वितरण का संपूर्ण अधिकार केवल सक्षम सरकारी विभाग के पास है।",
    mr: "पात्रतेचा अंतिम निर्णय आणि लाभाचे वितरण करण्याचे सर्व अधिकार केवळ सक्षम शासकीय विभागाकडे आहेत.",
    review_status: "machine_drafted",
  },
  "pre_trip.confirm_office": {
    en: "Confirm active intake window and budget availability with the local office before travelling",
    hi: "यात्रा करने से पहले स्थानीय कार्यालय से सक्रिय आवेदन स्थिति और बजट उपलब्धता की पुष्टि करें",
    mr: "प्रवासाला जाण्यापूर्वी स्थानिक कार्यालयात चालू अर्ज प्रक्रिया आणि उपलब्ध निधीची खात्री करा",
    review_status: "machine_drafted",
  },
  "error.sensitive_id_rejected": {
    en: "Government ID numbers (such as Aadhaar or PAN) must not be entered. Schemes Saathi does not collect or store identity card numbers.",
    hi: "सरकारी पहचान संख्या (जैसे आधार या पैन) दर्ज न करें। स्कीम साथी पहचान पत्र संख्या एकत्र या संग्रहीत नहीं करता है।",
    mr: "शासकीय ओळख क्रमांक (जसे की आधार किंवा पॅन) प्रविष्ट करू नका. स्कीम साथी ओळख क्रमांक गोळा किंवा साठवून ठेवत नाही.",
    review_status: "machine_drafted",
  },
};
