export default function SignupPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 420 }}>
      <h1>Sign up</h1>

      <form
        action="/api/auth/signup"
        method="post"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password (min 8 chars)</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            cursor: "pointer",
          }}
        >
          Create account
        </button>
      </form>

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}