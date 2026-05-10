export type Locale = "en" | "vi";
export type ThemeMode = "light" | "dark" | "system";

export interface StudentProfileDraft {
  fullName: string;
  grade: string;
  graduationYear: string;
  curriculum: string;
  gpa: string;
  ielts: string;
  sat: string;
  intendedMajors: string;
  extracurriculars: string;
  wantsEarlyRound: string;
  teacherRecommendationsReady: string;
  counselorDocumentsReady: string;
  essayDraftsStarted: string;
  annualBudget: string;
  scholarshipNeed: string;
  geographyPreferences: string;
  campusSize: string;
}

export type ProfileField = keyof StudentProfileDraft;

export interface ChatStep {
  key: ProfileField;
  skippable: boolean;
  prompts: Record<Locale, string>;
  quickReplies?: Record<Locale, string[]>;
  placeholder?: Record<Locale, string>;
}

export const initialProfileDraft: StudentProfileDraft = {
  fullName: "",
  grade: "",
  graduationYear: "",
  curriculum: "",
  gpa: "",
  ielts: "",
  sat: "",
  intendedMajors: "",
  extracurriculars: "",
  wantsEarlyRound: "",
  teacherRecommendationsReady: "",
  counselorDocumentsReady: "",
  essayDraftsStarted: "",
  annualBudget: "",
  scholarshipNeed: "",
  geographyPreferences: "",
  campusSize: "",
};

export const requiredProfileFields: ProfileField[] = [
  "fullName",
  "grade",
  "graduationYear",
  "intendedMajors",
  "annualBudget",
  "scholarshipNeed",
];

export const sectionFields: Array<{
  key: "academics" | "activities" | "readiness" | "preferences";
  fields: ProfileField[];
}> = [
  {
    key: "academics",
    fields: ["grade", "graduationYear", "curriculum", "gpa", "ielts", "sat"],
  },
  {
    key: "activities",
    fields: ["intendedMajors", "extracurriculars"],
  },
  {
    key: "readiness",
    fields: [
      "wantsEarlyRound",
      "teacherRecommendationsReady",
      "counselorDocumentsReady",
      "essayDraftsStarted",
    ],
  },
  {
    key: "preferences",
    fields: [
      "annualBudget",
      "scholarshipNeed",
      "geographyPreferences",
      "campusSize",
    ],
  },
];

export const profileLabels: Record<ProfileField, Record<Locale, string>> = {
  fullName: { en: "Student Name", vi: "Học sinh" },
  grade: { en: "Grade Level", vi: "Khối lớp" },
  graduationYear: { en: "Graduation Year", vi: "Năm tốt nghiệp" },
  curriculum: { en: "Curriculum", vi: "Chương trình học" },
  gpa: { en: "GPA", vi: "GPA" },
  ielts: { en: "IELTS/TOEFL", vi: "IELTS/TOEFL" },
  sat: { en: "SAT/ACT", vi: "SAT/ACT" },
  intendedMajors: { en: "Intended Major(s)", vi: "Ngành học dự định" },
  extracurriculars: { en: "Extracurriculars", vi: "Hoạt động ngoại khóa" },
  wantsEarlyRound: { en: "Wants Early Round", vi: "Có muốn nộp vòng sớm" },
  teacherRecommendationsReady: {
    en: "Has Teacher Recommendations Ready",
    vi: "Đã có thư giáo viên sẵn sàng",
  },
  counselorDocumentsReady: {
    en: "Has Counselor Documents Ready",
    vi: "Đã có hồ sơ counselor sẵn sàng",
  },
  essayDraftsStarted: {
    en: "Has Essay Drafts Started",
    vi: "Đã bắt đầu bản nháp bài luận",
  },
  annualBudget: { en: "Annual Budget", vi: "Ngân sách hàng năm" },
  scholarshipNeed: { en: "Scholarship Need", vi: "Nhu cầu học bổng" },
  geographyPreferences: { en: "Location Preference", vi: "Khu vực mong muốn" },
  campusSize: { en: "Campus Size", vi: "Quy mô trường" },
};

export const quickReplyLabels: Record<string, Record<Locale, string>> = {
  "Grade 9": { en: "Grade 9", vi: "Lớp 9" },
  "Grade 10": { en: "Grade 10", vi: "Lớp 10" },
  "Grade 11": { en: "Grade 11", vi: "Lớp 11" },
  "Grade 12": { en: "Grade 12", vi: "Lớp 12" },
  "Gap Year": { en: "Gap Year", vi: "Gap Year" },
  "Vietnamese National": {
    en: "Vietnamese National",
    vi: "Chương trình Quốc gia",
  },
  "IB (International Baccalaureate)": {
    en: "IB (International Baccalaureate)",
    vi: "IB (Tú tài Quốc tế)",
  },
  "AP (Advanced Placement)": {
    en: "AP (Advanced Placement)",
    vi: "AP (Advanced Placement)",
  },
  "A-Levels": { en: "A-Levels", vi: "A-Levels" },
  Other: { en: "Other", vi: "Khác" },
  "Not yet taken": { en: "Not yet taken", vi: "Chưa thi" },
  "IELTS 6.0-6.5": { en: "IELTS 6.0-6.5", vi: "IELTS 6.0-6.5" },
  "IELTS 6.5-7.0": { en: "IELTS 6.5-7.0", vi: "IELTS 6.5-7.0" },
  "IELTS 7.0-7.5": { en: "IELTS 7.0-7.5", vi: "IELTS 7.0-7.5" },
  "IELTS 7.5+": { en: "IELTS 7.5+", vi: "IELTS 7.5+" },
  "TOEFL 80-90": { en: "TOEFL 80-90", vi: "TOEFL 80-90" },
  "TOEFL 90-100": { en: "TOEFL 90-100", vi: "TOEFL 90-100" },
  "TOEFL 100+": { en: "TOEFL 100+", vi: "TOEFL 100+" },
  "Not planning to take": {
    en: "Not planning to take",
    vi: "Không dự định thi",
  },
  "Planning to take": { en: "Planning to take", vi: "Dự định thi" },
  "SAT 1200-1350": { en: "SAT 1200-1350", vi: "SAT 1200-1350" },
  "SAT 1350-1500": { en: "SAT 1350-1500", vi: "SAT 1350-1500" },
  "SAT 1500+": { en: "SAT 1500+", vi: "SAT 1500+" },
  "ACT 28-32": { en: "ACT 28-32", vi: "ACT 28-32" },
  "ACT 32+": { en: "ACT 32+", vi: "ACT 32+" },
  "Computer Science": { en: "Computer Science", vi: "Khoa học Máy tính" },
  "Business/Finance": { en: "Business/Finance", vi: "Kinh doanh/Tài chính" },
  Engineering: { en: "Engineering", vi: "Kỹ thuật" },
  "Medicine/Pre-Med": { en: "Medicine/Pre-Med", vi: "Y khoa/Tiền Y" },
  "Liberal Arts": { en: "Liberal Arts", vi: "Khoa học Xã hội" },
  Undecided: { en: "Undecided", vi: "Chưa quyết định" },
  "Yes - planning early": {
    en: "Yes - planning early",
    vi: "Có - dự định nộp sớm",
  },
  "No - regular rounds": {
    en: "No - regular rounds",
    vi: "Không - nộp vòng thường",
  },
  Yes: { en: "Yes", vi: "Có" },
  No: { en: "No", vi: "Không" },
  "Under $20,000": { en: "Under $20,000", vi: "Dưới $20,000" },
  "$20,000 - $40,000": { en: "$20,000 - $40,000", vi: "$20,000 - $40,000" },
  "$40,000 - $60,000": { en: "$40,000 - $60,000", vi: "$40,000 - $60,000" },
  "$60,000+": { en: "$60,000+", vi: "$60,000+" },
  Flexible: { en: "Flexible", vi: "Linh hoạt" },
  "Essential - can't attend without it": {
    en: "Essential - can't attend without it",
    vi: "Rất cần thiết",
  },
  "Important but not critical": {
    en: "Important but not critical",
    vi: "Quan trọng nhưng không bắt buộc",
  },
  "Nice to have": { en: "Nice to have", vi: "Có thì tốt" },
  "Not needed": { en: "Not needed", vi: "Không cần" },
  "US - East Coast": { en: "US - East Coast", vi: "Mỹ - Bờ Đông" },
  "US - West Coast": { en: "US - West Coast", vi: "Mỹ - Bờ Tây" },
  "US - Midwest": { en: "US - Midwest", vi: "Mỹ - Trung Tây" },
  "US - South": { en: "US - South", vi: "Mỹ - Miền Nam" },
  "No preference": { en: "No preference", vi: "Không yêu cầu" },
  Canada: { en: "Canada", vi: "Canada" },
  UK: { en: "UK", vi: "Vương quốc Anh" },
  "Small (under 5,000)": { en: "Small (under 5,000)", vi: "Nhỏ (dưới 5,000)" },
  "Medium (5,000-15,000)": {
    en: "Medium (5,000-15,000)",
    vi: "Vừa (5,000-15,000)",
  },
  "Large (15,000+)": { en: "Large (15,000+)", vi: "Lớn (trên 15,000)" },
};

export const onboardingSteps: ChatStep[] = [
  {
    key: "grade",
    skippable: false,
    prompts: {
      en: "Nice to meet you! What grade are you currently in?",
      vi: "Rất vui được gặp bạn! Bạn đang học lớp mấy?",
    },
    quickReplies: {
      en: ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "Gap Year"],
      vi: ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "Gap Year"],
    },
  },
  {
    key: "graduationYear",
    skippable: false,
    prompts: {
      en: "When do you expect to graduate from high school?",
      vi: "Bạn dự kiến tốt nghiệp THPT năm nào?",
    },
    quickReplies: {
      en: ["2026", "2027", "2028", "2029"],
      vi: ["2026", "2027", "2028", "2029"],
    },
  },
  {
    key: "curriculum",
    skippable: false,
    prompts: {
      en: "What curriculum are you following?",
      vi: "Bạn đang theo chương trình học nào?",
    },
    quickReplies: {
      en: [
        "Vietnamese National",
        "IB (International Baccalaureate)",
        "AP (Advanced Placement)",
        "A-Levels",
        "Other",
      ],
      vi: [
        "Vietnamese National",
        "IB (International Baccalaureate)",
        "AP (Advanced Placement)",
        "A-Levels",
        "Other",
      ],
    },
  },
  {
    key: "gpa",
    skippable: true,
    prompts: {
      en: "What's your current GPA? You can type the value and scale, for example 3.8/4.0 or 8.5/10.",
      vi: "Điểm GPA hiện tại của bạn là bao nhiêu? Ví dụ 3.8/4.0 hoặc 8.5/10.",
    },
    placeholder: {
      en: "3.8/4.0",
      vi: "8.5/10",
    },
  },
  {
    key: "ielts",
    skippable: true,
    prompts: {
      en: "Do you have an IELTS or TOEFL score? If so, what is it?",
      vi: "Bạn đã có điểm IELTS hoặc TOEFL chưa? Nếu có, điểm bao nhiêu?",
    },
    quickReplies: {
      en: [
        "Not yet taken",
        "IELTS 6.0-6.5",
        "IELTS 6.5-7.0",
        "IELTS 7.0-7.5",
        "IELTS 7.5+",
        "TOEFL 80-90",
        "TOEFL 90-100",
        "TOEFL 100+",
      ],
      vi: [
        "Not yet taken",
        "IELTS 6.0-6.5",
        "IELTS 6.5-7.0",
        "IELTS 7.0-7.5",
        "IELTS 7.5+",
        "TOEFL 80-90",
        "TOEFL 90-100",
        "TOEFL 100+",
      ],
    },
  },
  {
    key: "sat",
    skippable: true,
    prompts: {
      en: "How about SAT or ACT? Do you have a score or plan to take it?",
      vi: "Còn SAT hoặc ACT thì sao? Bạn đã có điểm hay dự định thi?",
    },
    quickReplies: {
      en: [
        "Not planning to take",
        "Planning to take",
        "SAT 1200-1350",
        "SAT 1350-1500",
        "SAT 1500+",
        "ACT 28-32",
        "ACT 32+",
      ],
      vi: [
        "Not planning to take",
        "Planning to take",
        "SAT 1200-1350",
        "SAT 1350-1500",
        "SAT 1500+",
        "ACT 28-32",
        "ACT 32+",
      ],
    },
  },
  {
    key: "intendedMajors",
    skippable: false,
    prompts: {
      en: "What major or field are you most interested in?",
      vi: "Bạn quan tâm đến ngành học nào nhất?",
    },
    quickReplies: {
      en: [
        "Computer Science",
        "Business/Finance",
        "Engineering",
        "Medicine/Pre-Med",
        "Liberal Arts",
        "Undecided",
      ],
      vi: [
        "Computer Science",
        "Business/Finance",
        "Engineering",
        "Medicine/Pre-Med",
        "Liberal Arts",
        "Undecided",
      ],
    },
  },
  {
    key: "extracurriculars",
    skippable: true,
    prompts: {
      en: "Tell me briefly about your extracurricular activities. What are you most proud of?",
      vi: "Hãy kể sơ qua về hoạt động ngoại khóa của bạn. Bạn tự hào nhất về điều gì?",
    },
  },
  {
    key: "wantsEarlyRound",
    skippable: true,
    prompts: {
      en: "Are you planning to apply in an early round?",
      vi: "Bạn có dự định nộp hồ sơ vòng sớm không?",
    },
    quickReplies: {
      en: ["Yes - planning early", "No - regular rounds"],
      vi: ["Yes - planning early", "No - regular rounds"],
    },
  },
  {
    key: "teacherRecommendationsReady",
    skippable: true,
    prompts: {
      en: "Do you already have teacher recommendations ready?",
      vi: "Bạn đã có thư giới thiệu từ giáo viên sẵn sàng chưa?",
    },
    quickReplies: {
      en: ["Yes", "No"],
      vi: ["Yes", "No"],
    },
  },
  {
    key: "counselorDocumentsReady",
    skippable: true,
    prompts: {
      en: "Are your counselor documents ready?",
      vi: "Hồ sơ counselor của bạn đã sẵn sàng chưa?",
    },
    quickReplies: {
      en: ["Yes", "No"],
      vi: ["Yes", "No"],
    },
  },
  {
    key: "essayDraftsStarted",
    skippable: true,
    prompts: {
      en: "Have you started your application essay drafts?",
      vi: "Bạn đã bắt đầu bản nháp bài luận chưa?",
    },
    quickReplies: {
      en: ["Yes", "No"],
      vi: ["Yes", "No"],
    },
  },
  {
    key: "annualBudget",
    skippable: false,
    prompts: {
      en: "What's your target annual budget for tuition and living expenses? You can answer in USD or VND.",
      vi: "Ngân sách hàng năm dự kiến cho học phí và sinh hoạt phí là bao nhiêu? Bạn có thể trả lời bằng USD hoặc VND.",
    },
    quickReplies: {
      en: [
        "Under $20,000",
        "$20,000 - $40,000",
        "$40,000 - $60,000",
        "$60,000+",
        "Flexible",
      ],
      vi: [
        "Under $20,000",
        "$20,000 - $40,000",
        "$40,000 - $60,000",
        "$60,000+",
        "Flexible",
      ],
    },
  },
  {
    key: "scholarshipNeed",
    skippable: false,
    prompts: {
      en: "How important is financial aid or scholarship for you?",
      vi: "Học bổng quan trọng như thế nào với bạn?",
    },
    quickReplies: {
      en: [
        "Essential - can't attend without it",
        "Important but not critical",
        "Nice to have",
        "Not needed",
      ],
      vi: [
        "Essential - can't attend without it",
        "Important but not critical",
        "Nice to have",
        "Not needed",
      ],
    },
  },
  {
    key: "geographyPreferences",
    skippable: true,
    prompts: {
      en: "Do you have any preferences for university location?",
      vi: "Bạn có yêu cầu gì về vị trí trường đại học không?",
    },
    quickReplies: {
      en: [
        "US - East Coast",
        "US - West Coast",
        "US - Midwest",
        "US - South",
        "No preference",
        "Canada",
        "UK",
      ],
      vi: [
        "US - East Coast",
        "US - West Coast",
        "US - Midwest",
        "US - South",
        "No preference",
        "Canada",
        "UK",
      ],
    },
  },
  {
    key: "campusSize",
    skippable: true,
    prompts: {
      en: "What campus size do you prefer?",
      vi: "Bạn thích quy mô khuôn viên trường như thế nào?",
    },
    quickReplies: {
      en: [
        "Small (under 5,000)",
        "Medium (5,000-15,000)",
        "Large (15,000+)",
        "No preference",
      ],
      vi: [
        "Small (under 5,000)",
        "Medium (5,000-15,000)",
        "Large (15,000+)",
        "No preference",
      ],
    },
  },
];

export const copy = {
  en: {
    authTitle: "ETEST Compass",
    authSubtitle:
      "Sign in to build your profile and get personalized US university recommendations",
    authGoogle: "Continue with Google",
    authFacebook: "Continue with Facebook",
    authOr: "or",
    authEmailPlaceholder: "Enter your email address",
    authSendMagicLink: "Send Magic Link",
    authCheckEmail: "Check your email!",
    authMagicLinkSent: "We sent a magic link to",
    authSimulateMagic: "Simulate: Open Magic Link",
    authDifferentEmail: "Use a different email",
    authTrust:
      "Your data is encrypted and never shared with third parties. This workspace saves to the canonical onboarding backend.",
    authTerms: "By continuing, you agree to our",
    authTermsOfService: "Terms of Service",
    authAnd: "and",
    authPrivacy: "Privacy Policy",
    headerTitle: "ETEST Compass",
    headerLogin: "Log In / Sign Up",
    headerProfile: "My Profile",
    headerPlan: "Account & Plan",
    headerLogout: "Log out",
    chatTitle: "ETEST Compass Guide",
    chatActive: "Active",
    chatPlaceholder: "Type your answer...",
    chatComplete: "Conversation complete!",
    chatSkip: "Skip",
    chatSkipped: "Skipped",
    chatWelcome:
      "Hi {name}! Welcome to ETEST Compass. I'm here to help you build your college admissions profile. Let's get started with a few questions to find the best universities for you.",
    chatDone:
      "Excellent! Your profile is looking great. I have enough information to generate personalized college recommendations for you. Click the button on your profile to continue.",
    profileTitle: "Student Profile",
    profileSubtitle: "Live profile preview",
    profileFields: "fields",
    profileCompletion: "Profile completion",
    profileGenerate: "Generate Recommendations",
    mobileProfile: "Profile",
    mobileYourProfile: "Your Profile",
    sectionAcademics: "Academics",
    sectionActivities: "Activities",
    sectionReadiness: "Readiness",
    sectionPreferences: "Preferences & Budget",
  },
  vi: {
    authTitle: "ETEST Compass",
    authSubtitle:
      "Đăng nhập để xây dựng hồ sơ và nhận gợi ý trường đại học Mỹ phù hợp với bạn",
    authGoogle: "Tiếp tục với Google",
    authFacebook: "Tiếp tục với Facebook",
    authOr: "hoặc",
    authEmailPlaceholder: "Nhập địa chỉ email của bạn",
    authSendMagicLink: "Gửi liên kết đăng nhập",
    authCheckEmail: "Kiểm tra email của bạn!",
    authMagicLinkSent: "Chúng tôi đã gửi liên kết đăng nhập đến",
    authSimulateMagic: "Mô phỏng: Mở liên kết đăng nhập",
    authDifferentEmail: "Dùng email khác",
    authTrust:
      "Dữ liệu của bạn được mã hóa và không chia sẻ với bên thứ ba. Workspace này lưu dữ liệu vào backend onboarding chính thức.",
    authTerms: "Bằng việc tiếp tục, bạn đồng ý với",
    authTermsOfService: "Điều khoản Dịch vụ",
    authAnd: "và",
    authPrivacy: "Chính sách Bảo mật",
    headerTitle: "ETEST Compass",
    headerLogin: "Đăng nhập",
    headerProfile: "Hồ sơ của tôi",
    headerPlan: "Gói tài khoản",
    headerLogout: "Đăng xuất",
    chatTitle: "Trợ lý ETEST Compass",
    chatActive: "Đang hoạt động",
    chatPlaceholder: "Nhập câu trả lời của bạn...",
    chatComplete: "Cuộc trò chuyện đã hoàn tất!",
    chatSkip: "Bỏ qua",
    chatSkipped: "Đã bỏ qua",
    chatWelcome:
      "Xin chào {name}! Chào mừng bạn đến với ETEST Compass. Mình sẽ giúp bạn xây dựng hồ sơ du học. Hãy bắt đầu với một vài câu hỏi để tìm trường đại học phù hợp nhất nhé!",
    chatDone:
      "Tuyệt vời! Hồ sơ của bạn đã khá đầy đủ. Mình đã có đủ thông tin để gợi ý trường đại học phù hợp cho bạn. Hãy nhấn nút trên hồ sơ để tiếp tục.",
    profileTitle: "Hồ sơ Học sinh",
    profileSubtitle: "Hồ sơ cập nhật trực tiếp",
    profileFields: "mục",
    profileCompletion: "Mức độ hoàn thành",
    profileGenerate: "Tạo Gợi ý Trường",
    mobileProfile: "Hồ sơ",
    mobileYourProfile: "Hồ sơ của bạn",
    sectionAcademics: "Học tập",
    sectionActivities: "Hoạt động",
    sectionReadiness: "Sẵn sàng",
    sectionPreferences: "Sở thích & Ngân sách",
  },
} as const;
