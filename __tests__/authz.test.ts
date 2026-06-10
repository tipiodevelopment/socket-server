import type { User } from "../shared/schema";
import {
  SESSION_COOKIE,
  createApiGate,
  createSessionToken,
  isPublicApiPath,
  readSessionOperatorId,
  requiredRoleFor,
  resolveAllowlistedOperator,
  roleAtLeast,
} from "../server/middleware/authz";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    reachuUserId: null,
    firebaseUid: null,
    role: "viewer",
    sponsorId: null,
    email: "ops@vio.live",
    name: "Ops",
    firebaseToken: null,
    createdAt: new Date(),
    ...overrides,
  } as User;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

function reqWithSession(operatorId: number, method: string, path: string) {
  const token = createSessionToken(operatorId);
  return {
    method,
    baseUrl: "/api",
    path: path.replace(/^\/api/, ""),
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  } as any;
}

describe("route policy", () => {
  it("classifies the public end-user surface", () => {
    expect(isPublicApiPath("GET", "/api/status")).toBe(true);
    expect(isPublicApiPath("POST", "/api/auth/token")).toBe(true);
    expect(isPublicApiPath("GET", "/api/campaigns/12")).toBe(true);
    expect(isPublicApiPath("GET", "/api/events/12")).toBe(true);
    expect(isPublicApiPath("GET", "/api/campaigns")).toBe(false);
    expect(isPublicApiPath("PUT", "/api/campaigns/12")).toBe(false);
    expect(isPublicApiPath("GET", "/api/campaigns/12/stats")).toBe(false);
  });

  it("maps user management to super_admin", () => {
    expect(requiredRoleFor("GET", "/api/users")).toBe("super_admin");
    expect(requiredRoleFor("GET", "/api/auth/users")).toBe("super_admin");
    expect(requiredRoleFor("DELETE", "/api/auth/users/4")).toBe("super_admin");
  });

  it("maps app/sponsor registration to admin and the rest to operator/viewer", () => {
    expect(requiredRoleFor("POST", "/api/client-apps")).toBe("admin");
    expect(requiredRoleFor("DELETE", "/api/sponsors/3")).toBe("admin");
    expect(requiredRoleFor("POST", "/api/campaigns")).toBe("operator");
    expect(requiredRoleFor("PATCH", "/api/broadcasts/9")).toBe("operator");
    expect(requiredRoleFor("GET", "/api/campaigns")).toBe("viewer");
  });

  it("applies the role hierarchy", () => {
    expect(roleAtLeast("super_admin", "admin")).toBe(true);
    expect(roleAtLeast("admin", "operator")).toBe(true);
    expect(roleAtLeast("operator", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "operator")).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips the operator id through the cookie", () => {
    const req = reqWithSession(42, "GET", "/api/campaigns");
    expect(readSessionOperatorId(req)).toBe(42);
  });

  it("rejects a tampered cookie", () => {
    const req = {
      headers: { cookie: `${SESSION_COOKIE}=not.a.token` },
    } as any;
    expect(readSessionOperatorId(req)).toBeNull();
  });
});

describe("resolveAllowlistedOperator (strict allowlist)", () => {
  const identity = { uid: "uid-1", email: "Ops@vio.live", name: "Ops" };

  it("returns the user matched by firebase uid", async () => {
    const user = fakeUser({ firebaseUid: "uid-1" });
    const dir = {
      getUserByFirebaseUid: jest.fn().mockResolvedValue(user),
      getUserByEmailInsensitive: jest.fn(),
      updateUser: jest.fn(),
      createUser: jest.fn(),
    };
    await expect(resolveAllowlistedOperator(dir, identity)).resolves.toBe(user);
  });

  it("links the uid on first login when the email is allowlisted", async () => {
    const provisioned = fakeUser({ id: 7, firebaseUid: null });
    const linked = fakeUser({ id: 7, firebaseUid: "uid-1" });
    const dir = {
      getUserByFirebaseUid: jest.fn().mockResolvedValue(undefined),
      getUserByEmailInsensitive: jest.fn().mockResolvedValue(provisioned),
      updateUser: jest.fn().mockResolvedValue(linked),
      createUser: jest.fn(),
    };
    await expect(resolveAllowlistedOperator(dir, identity)).resolves.toBe(linked);
    expect(dir.updateUser).toHaveBeenCalledWith(7, expect.objectContaining({ firebaseUid: "uid-1" }));
  });

  it("refuses when the email is already linked to another uid", async () => {
    const dir = {
      getUserByFirebaseUid: jest.fn().mockResolvedValue(undefined),
      getUserByEmailInsensitive: jest.fn().mockResolvedValue(fakeUser({ firebaseUid: "other-uid" })),
      updateUser: jest.fn(),
      createUser: jest.fn(),
    };
    await expect(resolveAllowlistedOperator(dir, identity)).resolves.toBeNull();
    expect(dir.updateUser).not.toHaveBeenCalled();
  });

  it("refuses unknown accounts (no auto-provision)", async () => {
    const dir = {
      getUserByFirebaseUid: jest.fn().mockResolvedValue(undefined),
      getUserByEmailInsensitive: jest.fn().mockResolvedValue(undefined),
      updateUser: jest.fn(),
      createUser: jest.fn(),
    };
    await expect(resolveAllowlistedOperator(dir, identity)).resolves.toBeNull();
    expect(dir.createUser).not.toHaveBeenCalled();
  });

  it("bootstraps super_admin for ADMIN_EMAILS", async () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "boss@vio.live, ops@vio.live";
    try {
      const created = fakeUser({ role: "super_admin", firebaseUid: "uid-1" });
      const dir = {
        getUserByFirebaseUid: jest.fn().mockResolvedValue(undefined),
        getUserByEmailInsensitive: jest.fn().mockResolvedValue(undefined),
        updateUser: jest.fn(),
        createUser: jest.fn().mockResolvedValue(created),
      };
      await expect(resolveAllowlistedOperator(dir, identity)).resolves.toBe(created);
      expect(dir.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ops@vio.live", role: "super_admin", firebaseUid: "uid-1" }),
      );
    } finally {
      if (previous === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = previous;
    }
  });
});

describe("createApiGate", () => {
  it("lets the public surface through without a session", async () => {
    const gate = createApiGate({ loadOperator: jest.fn() });
    const res = mockRes();
    const next = jest.fn();
    await gate({ method: "GET", baseUrl: "/api", path: "/campaigns/3", headers: {} } as any, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 without a session cookie", async () => {
    const gate = createApiGate({ loadOperator: jest.fn() });
    const res = mockRes();
    const next = jest.fn();
    await gate({ method: "GET", baseUrl: "/api", path: "/campaigns", headers: {} } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 and clears the cookie when the operator row is gone", async () => {
    const gate = createApiGate({ loadOperator: jest.fn().mockResolvedValue(undefined) });
    const res = mockRes();
    const next = jest.fn();
    await gate(reqWithSession(99, "GET", "/api/campaigns"), res, next);
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when the role is insufficient", async () => {
    const gate = createApiGate({ loadOperator: jest.fn().mockResolvedValue(fakeUser({ role: "viewer" })) });
    const res = mockRes();
    const next = jest.fn();
    await gate(reqWithSession(1, "POST", "/api/campaigns"), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the operator and continues when authorized", async () => {
    const operator = fakeUser({ role: "operator" });
    const gate = createApiGate({ loadOperator: jest.fn().mockResolvedValue(operator) });
    const res = mockRes();
    const next = jest.fn();
    const req = reqWithSession(1, "POST", "/api/campaigns");
    await gate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.operator).toBe(operator);
  });
});
