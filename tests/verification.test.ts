import { describe, expect, it } from "vitest";
import { getVerificationState, verificationDescription, verificationLabel } from "../lib/verification";

describe("verification states", () => {
  it("never upgrades legacy certification flags into a credential check", () => {
    expect(getVerificationState({ is_certified: true, pirb_number: "123" })).toBe("directory_record");
  });

  it("uses ownership only as a claimed-business state", () => {
    expect(getVerificationState({ profile_id: "owner-id" })).toBe("business_claimed");
  });

  it("honours an explicit credential check", () => {
    expect(getVerificationState({ verification_state: "credential_verified" })).toBe("credential_verified");
    expect(verificationLabel("credential_verified")).toBe("Credential verified");
    expect(verificationDescription("business_claimed")).toContain("Professional registration");
  });
});
