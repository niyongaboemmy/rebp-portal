/**
 * A complete applicant CV (UX-018/021) for demo and test applicants: an A2 qualification,
 * entry-level training with the exam passed, and FSLA practice since 2019 — enough for every
 * category's CV parts, so they can apply without first filling it in.
 */
export function sampleCv() {
  return {
    c: {
      highestLevel: "A2",
      qualifications: [
        {
          id: "cv-a2",
          institution: "GS Kimironko",
          qualification: "A2 certificate",
          fieldOfStudy: "GENERAL_SECONDARY",
          yearCompleted: 2016,
          isForeign: false,
        },
      ],
    },
    d: {
      trainingCompleted: true,
      trainingProvider: "PBTI",
      trainingProgramme: "ENTRY",
      trainingCompletedOn: "2018-11-30",
      trainingCertificateNo: "PBTI-ENT-2018-001",
      examPassed: "YES",
      examReference: "EXAM-2025-001",
      examDate: "2025-06-01",
    },
    e: {
      records: [
        {
          id: "cv-fsla",
          firm: "Keza Realty Ltd",
          category: "FSLA",
          from: "2019-01-01",
          current: true,
          duties: "Property viewings, client follow-up and listings.",
        },
      ],
      priorCategoryForExperience: "FSLA",
      initialRegistrationDate: "2019-01-01",
      equivalentRecognised: false,
    },
  };
}
