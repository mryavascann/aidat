// Keep cryptographic verification required for both local and external devices.
export const registrationSelection = (method = "device") => ({
  ...(method === "device" ? { authenticatorAttachment: "platform" } : {}),
  residentKey: "required",
});

export function authenticationOptions(options, method = "device") {
  return {
    ...options,
    optionsJSON: {
      ...options.optionsJSON,
      hints:
        method === "device" ? ["client-device"] : ["hybrid", "security-key"],
      userVerification: "required",
    },
  };
}
