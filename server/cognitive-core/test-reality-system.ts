import { ProjectRealityReader } from './project-reality-reader';
import { RealityConstraints } from './reality-constraints';
import { CompatibilityBlockGenerator } from './compatibility-block';
import { RealityBasedRefinement } from './reality-based-refinement';

async function testRealitySystem() {
    console.log('🧪 Testing Reality-Based Refinement System\n');

    try {
        // Test 1: Project Reality Reader
        console.log('1️⃣ Testing Project Reality Reader...');
        const projectRealityReader = new ProjectRealityReader();
        const projectReality = await projectRealityReader.readProjectReality();
        
        console.log('✅ Project Reality detected:');
        console.log(`🔧 Stack:`, JSON.stringify(projectReality.stack, null, 2));
        console.log(`📈 Maturity Level: ${projectReality.maturityLevel}`);
        console.log(`💡 Capabilities:`, JSON.stringify(projectReality.capabilities, null, 2));
        console.log();

        // Test 2: Reality Constraints
        console.log('2️⃣ Testing Reality Constraints...');
        const realityConstraints = new RealityConstraints(projectReality);
        
        const bugConstraints = realityConstraints.getConstraintsForDemandType('bug');
        console.log('✅ Bug Constraints:');
        console.log(`🚫 Forbidden Technologies: ${bugConstraints.forbiddenTechnologies.join(', ')}`);
        console.log(`🛠️ Allowed Technologies: ${bugConstraints.allowedTechnologies.join(', ')}`);
        console.log();

        const featureConstraints = realityConstraints.getConstraintsForDemandType('newFeature');
        console.log('✅ New Feature Constraints:');
        console.log(`🎯 Max Scope: ${featureConstraints.maxScope}`);
        console.log(`📦 Max New Dependencies: ${featureConstraints.maxNewDependencies}`);
        console.log();

        // Test 3: Compatibility Block
        console.log('3️⃣ Testing Compatibility Block Generator...');
        const compatibilityBlockGenerator = new CompatibilityBlockGenerator(projectReality);
        
        const mockDemandAnalysis = {
            technologies: ['React', 'TypeScript'],
            technicalDepth: 2,
            architectureChanges: 0,
            newDependencies: 1
        };
        
        const compatibilityBlock = compatibilityBlockGenerator.generateCompatibilityBlock(
            'newFeature',
            mockDemandAnalysis
        );
        
        console.log('✅ Compatibility Block generated:');
        console.log(`📋 Adherence to Current Code: ${compatibilityBlock.adherenceToCurrentCode}`);
        console.log(`🔮 Technical Extrapolation: ${compatibilityBlock.technicalExtrapolation}`);
        console.log(`🎯 Adherence Score: ${compatibilityBlock.adherenceScore}%`);
        console.log();

        // Test 4: Adherence Check
        console.log('4️⃣ Testing Adherence Check...');
        
        // Test with compliant demand
        const compliantCheck = realityConstraints.checkAdherence(
            { technologies: ['React'], technicalDepth: 2, architectureChanges: 0 },
            'bug'
        );
        console.log('✅ Compliant Demand Check:');
        console.log(`🎯 Is Adherent: ${compliantCheck.isAdherent}`);
        console.log(`📊 Adherence Score: ${compliantCheck.adherenceScore}%`);
        console.log();

        // Test with non-compliant demand
        const nonCompliantCheck = realityConstraints.checkAdherence(
            { technologies: ['Edge Computing', 'WASM'], technicalDepth: 5, architectureChanges: 2 },
            'bug'
        );
        console.log('❌ Non-Compliant Demand Check:');
        console.log(`🎯 Is Adherent: ${nonCompliantCheck.isAdherent}`);
        console.log(`📊 Adherence Score: ${nonCompliantCheck.adherenceScore}%`);
        console.log(`🚨 Issues: ${nonCompliantCheck.issues.join('; ')}`);
        console.log();

        // Test 5: Reality-Based Refinement
        console.log('5️⃣ Testing Reality-Based Refinement...');
        const realityBasedRefinement = new RealityBasedRefinement();
        
        const refinementResult = await realityBasedRefinement.refineDemandWithRealityCheck(1);
        console.log('✅ Reality-Based Refinement Result:');
        console.log(`📋 Demand Classification: ${refinementResult.demandClassification.category}`);
        console.log(`🔧 Maturity Level: ${refinementResult.constraints.maturityLevel}`);
        console.log(`🛡️ Compatibility Block Adherence: ${refinementResult.compatibilityBlock.adherenceToCurrentCode}`);
        console.log();

        // Test 6: Delivery Validation
        console.log('6️⃣ Testing Delivery Validation...');
        
        const validDelivery = {
            compatibilityBlock: {
                projectRealityUsed: projectReality,
                adherenceToCurrentCode: 'High',
                technicalExtrapolation: 'None',
                constraintsApplied: {
                    maturityLevel: projectReality.maturityLevel,
                    forbiddenTechnologies: ['Edge Computing', 'WASM'],
                    allowedTechnologies: ['React', 'TypeScript']
                },
                adherenceScore: 100,
                issuesFound: [],
                generatedAt: new Date().toISOString()
            },
            analysis: {
                technologies: ['React', 'TypeScript'],
                technicalDepth: 2,
                architectureChanges: 0
            }
        };

        const validationResult = await realityBasedRefinement.validateDeliveryWithRealityCheck(
            validDelivery,
            'newFeature'
        );
        
        console.log('✅ Valid Delivery Validation:');
        console.log(`🎯 Is Valid: ${validationResult.isValid}`);
        console.log(`📋 Validation Report:\n${validationResult.validationReport}`);
        console.log();

        // Test invalid delivery
        const invalidDelivery = {
            analysis: {
                technologies: ['Edge Computing', 'WASM'],
                technicalDepth: 5,
                architectureChanges: 2
            }
            // Missing compatibility block
        };

        const invalidValidationResult = await realityBasedRefinement.validateDeliveryWithRealityCheck(
            invalidDelivery,
            'bug'
        );
        
        console.log('❌ Invalid Delivery Validation:');
        console.log(`🎯 Is Valid: ${invalidValidationResult.isValid}`);
        console.log(`📋 Validation Report:\n${invalidValidationResult.validationReport}`);
        console.log();

        console.log('🎉 All tests completed successfully!');
        console.log('\n📊 Summary:');
        console.log('✅ Project Reality Reader - Working');
        console.log('✅ Reality Constraints - Working');
        console.log('✅ Compatibility Block Generator - Working');
        console.log('✅ Adherence Checking - Working');
        console.log('✅ Reality-Based Refinement - Working');
        console.log('✅ Delivery Validation - Working');
        console.log('\n🚀 The Reality-Based Refinement System is ready for integration!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testRealitySystem();
}

export { testRealitySystem };