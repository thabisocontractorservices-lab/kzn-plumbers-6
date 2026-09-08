import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedAdminEmail } from "../lib/admin-identity";

afterEach(()=>vi.unstubAllEnvs());
describe("server administrator identity backstop",()=>{
  it("refuses missing or arbitrary addresses",()=>{
    expect(isAllowedAdminEmail(null)).toBe(false);expect(isAllowedAdminEmail("random@example.org")).toBe(false);
  });
  it("uses an explicit allowlist override without granting anyone else access",()=>{
    vi.stubEnv("ADMIN_ALLOWED_EMAILS","owner@example.org");
    expect(isAllowedAdminEmail(" OWNER@example.org ")).toBe(true);
    expect(isAllowedAdminEmail("thabisocontractorservices@gmail.com")).toBe(false);
  });
  it("fails closed when an override is present but empty",()=>{
    vi.stubEnv("ADMIN_ALLOWED_EMAILS","");expect(isAllowedAdminEmail("thabisocontractorservices@gmail.com")).toBe(false);
  });
});
