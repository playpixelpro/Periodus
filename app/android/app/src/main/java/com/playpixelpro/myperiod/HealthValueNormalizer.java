package com.playpixelpro.myperiod;

/**
 * Keeps platform enum integers out of the shared TypeScript health contract.
 * Values mirror Android's MenstruationFlowType and OvulationTestResult enums.
 */
final class HealthValueNormalizer {
    private HealthValueNormalizer() {}

    static String menstrualFlow(int value) {
        switch (value) {
            case 1: // FLOW_LIGHT
                return "light";
            case 2: // FLOW_MEDIUM
                return "medium";
            case 3: // FLOW_HEAVY
                return "heavy";
            default: // FLOW_UNKNOWN
                return null;
        }
    }

    static String ovulationTest(int value) {
        switch (value) {
            case 1: // RESULT_POSITIVE
            case 2: // RESULT_HIGH
                return "positive";
            case 3: // RESULT_NEGATIVE
                return "negative";
            default: // RESULT_INCONCLUSIVE
                return null;
        }
    }
}
