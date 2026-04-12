import { App } from "./components/App";
import { setupLogger } from "./utils/logger";

const logger = setupLogger("main");

logger.info("Starting application...");
const app = new App({ debug: false });
app.start();
