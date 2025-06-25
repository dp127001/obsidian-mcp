/**
 * Validation Service
 * 
 * Provides validation capabilities for vault operations
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationService {
  
  /**
   * Validate vault access and permissions
   */
  async validateVaultAccess(vaultName: string, vaultPath?: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!vaultName) {
      result.isValid = false;
      result.errors.push('Vault name is required');
      return result;
    }

    if (vaultPath) {
      try {
        // Check if vault directory exists
        const stats = await fs.stat(vaultPath);
        if (!stats.isDirectory()) {
          result.isValid = false;
          result.errors.push(`Vault path is not a directory: ${vaultPath}`);
          return result;
        }

        // Check for .obsidian directory
        const obsidianPath = path.join(vaultPath, '.obsidian');
        try {
          const obsidianStats = await fs.stat(obsidianPath);
          if (!obsidianStats.isDirectory()) {
            result.isValid = false;
            result.errors.push(`Invalid Obsidian vault: .obsidian is not a directory`);
          }
        } catch (error) {
          result.isValid = false;
          result.errors.push(`Invalid Obsidian vault: Missing .obsidian directory`);
        }

        // Check read/write permissions
        try {
          await fs.access(vaultPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (error) {
          result.isValid = false;
          result.errors.push(`Insufficient permissions for vault directory: ${vaultPath}`);
        }

      } catch (error) {
        result.isValid = false;
        result.errors.push(`Cannot access vault directory: ${vaultPath}`);
      }
    }

    return result;
  }

  /**
   * Validate note path
   */
  validateNotePath(notePath: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!notePath) {
      result.isValid = false;
      result.errors.push('Note path is required');
      return result;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(notePath)) {
      result.isValid = false;
      result.errors.push('Note path contains invalid characters');
    }

    // Check for proper .md extension
    if (!notePath.endsWith('.md')) {
      result.warnings.push('Note path should end with .md extension');
    }

    return result;
  }

  /**
   * Validate CL state value
   */
  validateCLState(state: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const validStates = ['plasma', 'fluid', 'gel', 'crystal'];
    if (!validStates.includes(state)) {
      result.isValid = false;
      result.errors.push(`Invalid CL state: ${state}. Valid states: ${validStates.join(', ')}`);
    }

    return result;
  }
}
