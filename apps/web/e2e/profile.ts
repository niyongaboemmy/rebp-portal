export { sampleCv } from "../src/test/sample-cv";

/**
 * A complete applicant profile (UX-010) for users a spec creates directly in the database, so
 * they aren't sent to the profile page first. Kigali › Gasabo › Kimihurura address.
 */
export function completeProfile(email: string, fullName: string, phone = "+250788000999") {
  const [givenNames, ...rest] = fullName.split(" ");
  return {
    surname: rest.join(" ") || "Applicant",
    givenNames,
    fullNameOnId: fullName,
    idType: "NATIONAL_ID",
    idNumber: `11990${String(Date.now()).slice(-11)}`,
    dateOfBirth: "1990-01-15",
    gender: "UNDISCLOSED",
    nationality: ["RW"],
    phone,
    email,
    residentialAddress: {
      province: "1",
      district: "12",
      sector: "1208",
      cell: "120803",
      village: "12080304",
    },
    professionalSameAsResidential: true,
    occupation: "Real estate practitioner",
  };
}
