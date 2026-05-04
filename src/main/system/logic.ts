import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getSystemFonts(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('fc-list :lang=en --format="%{family}\n"');
    return [...new Set(stdout.split('\n').map(f => f.trim()).filter(Boolean))].sort();
  } catch {
    return ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
  }
}
