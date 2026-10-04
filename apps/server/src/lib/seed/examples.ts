import path from 'node:path';

import { BUILTIN_SCREENS, type BuiltinScreen } from './screens';

/** Folder under examples/ for each built-in screen; their screen.html files mirror the seed templates. */
export const EXAMPLE_FOLDERS: Record<string, string> = {
  'builtin-morning-brief': 'default',
  'builtin-clock': 'clock',
  'builtin-clock-weather': 'clock-weather',
  'builtin-dial': 'dial',
};

/** Absolute path of the repo's examples/ folder (resolved from apps/server). */
export const EXAMPLES_DIR = path.resolve(process.cwd(), '../../examples');

/** Built-in screens paired with their example folder, in seed order. */
export function builtinExamples(): { screen: BuiltinScreen; folder: string }[] {
  return BUILTIN_SCREENS.map((screen) => {
    const folder = EXAMPLE_FOLDERS[screen.id];
    if (!folder) throw new Error(`No example folder for ${screen.id}`);
    return { screen, folder };
  });
}
