import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kiosk-bridge/src/main.js');
await import(pathToFileURL(target).href);
