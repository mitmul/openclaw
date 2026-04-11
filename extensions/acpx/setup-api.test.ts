import { describe, expect, it, vi } from "vitest";
import entry from "./setup-api.js";

describe("acpx setup api", () => {
  it("registers the acpx runtime service and auto-enable probe", () => {
    const registerService = vi.fn();
    const registerAutoEnableProbe = vi.fn();

    entry.register({
      registerService,
      registerAutoEnableProbe,
    } as never);

    expect(registerService).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "acpx-runtime",
        start: expect.any(Function),
      }),
    );
    expect(registerAutoEnableProbe).toHaveBeenCalledTimes(1);

    const probe = registerAutoEnableProbe.mock.calls[0]?.[0] as
      | ((params: { config: Record<string, unknown> }) => string | null)
      | undefined;
    expect(
      probe?.({
        config: {
          acp: {
            backend: "acpx",
          },
        },
      }),
    ).toBe("ACP runtime configured");
    expect(probe?.({ config: {} })).toBeNull();
  });
});
