import { describe, it, expect } from 'vitest';
import { getDemandTypeConfig, DEMAND_TYPES } from '../shared/demand-types';

describe('Demand Type to Plugin Mapping', () => {
  it('should map nova_funcionalidade to FeaturePlugin', () => {
    const config = getDemandTypeConfig('nova_funcionalidade');
    expect(config.plugin).toBe('FeaturePlugin');
  });

  it('should map melhoria to ImprovementPlugin', () => {
    const config = getDemandTypeConfig('melhoria');
    expect(config.plugin).toBe('ImprovementPlugin');
  });

  it('should map bug to BugPlugin', () => {
    const config = getDemandTypeConfig('bug');
    expect(config.plugin).toBe('BugPlugin');
  });

  it('should map discovery to DiscoveryPlugin', () => {
    const config = getDemandTypeConfig('discovery');
    expect(config.plugin).toBe('DiscoveryPlugin');
  });

  it('should map analise_exploratoria to DiscoveryPlugin', () => {
    const config = getDemandTypeConfig('analise_exploratoria');
    expect(config.plugin).toBe('DiscoveryPlugin');
  });

  it('should return discovery config for unknown types (fallback)', () => {
    // @ts-ignore - testing runtime fallback for invalid type
    const config = getDemandTypeConfig('unknown_type');
    expect(config.plugin).toBe('DiscoveryPlugin');
  });
});

describe('Demand Type Metadata Consistency', () => {
  Object.entries(DEMAND_TYPES).forEach(([type, config]) => {
    it(`should have all required fields for ${type}`, () => {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('shortLabel');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('plugin');
      expect(config).toHaveProperty('prdTemplate');
      expect(config).toHaveProperty('refinementLevel');
      expect(config).toHaveProperty('intensity');
      expect(config).toHaveProperty('defaultTeam');
      expect(config).toHaveProperty('defaultResolutionMinutes');
      expect(config).toHaveProperty('complexityAdjustment');
      expect(config).toHaveProperty('baseSuccessRate');
      expect(config).toHaveProperty('canonicalDemandType');
      expect(config).toHaveProperty('outputType');
      expect(config).toHaveProperty('typeRequirements');
      expect(Array.isArray(config.typeRequirements)).toBe(true);
      expect(config).toHaveProperty('maxEffortDays');
      expect(config).toHaveProperty('minROI');
      expect(config).toHaveProperty('primaryFramework');
      expect(config).toHaveProperty('secondaryFrameworks');
      expect(Array.isArray(config.secondaryFrameworks)).toBe(true);
      expect(config).toHaveProperty('resolutionMultiplier');
      expect(config).toHaveProperty('classifierScoreAdjustments');
    });
  });
});
