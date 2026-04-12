import { App } from "./components/App";
import { setupLogger } from "./utils/logger";
import { loadConfig } from "./config/loader";

const logger = setupLogger("main");
const config = loadConfig();

logger.info("Starting application...", { env: config.env });
const app = new App({ debug: config.debug, port: config.port });
app.start();
