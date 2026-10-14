import { GarminAuth } from "./garmin-auth.js";
import { LoginSession } from "./login-session.js";

const session = new LoginSession();
try {
  if (session.claim()) {
    try {
      const auth = await new GarminAuth().authenticate();
      if (!auth) throw new Error("Login did not produce a valid session. Run authenticate_garmin to retry.");
      session.write({ state: "success", message: "Garmin login completed." });
    } catch (error) {
      // Only known, authored messages are returned; browser errors can contain URLs.
      const message = error instanceof Error ? error.message : "Login failed.";
      const known = /^(The Garmin login profile|Chrome is missing|Garmin browser login needs|Could not open the Garmin login browser|Login window closed|Timed out waiting for login|Login did not produce)/;
      session.write({ state: "error", message: known.test(message) ? message : "Garmin login failed while opening the page or saving the session. Check your connection and configuration directory permissions, then retry." });
    } finally {
      session.release();
    }
  }
} catch {
  session.write({ state: "error", message: "Login coordination failed. Check configuration directory permissions. If login-claim.lock remains after an interrupted helper, remove that directory and retry." });
}
