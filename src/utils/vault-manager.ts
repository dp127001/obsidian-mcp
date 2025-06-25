/**
 * Vault Manager Utility
 * 
 * Provides unified vault access and management capabilities
 */

export class VaultManager {
  private vaults: Map<string, string> = new Map();

  constructor(vaults?: Map<string, string>) {
    if (vaults) {
      this.vaults = vaults;
    }
  }

  /**
   * Get vault path by name
   */
  getVaultPath(vaultName: string): string | undefined {
    return this.vaults.get(vaultName);
  }

  /**
   * Check if vault exists
   */
  hasVault(vaultName: string): boolean {
    return this.vaults.has(vaultName);
  }

  /**
   * List all available vaults
   */
  listVaults(): string[] {
    return Array.from(this.vaults.keys());
  }

  /**
   * Set vaults configuration
   */
  setVaults(vaults: Map<string, string>) {
    this.vaults = vaults;
  }
}
