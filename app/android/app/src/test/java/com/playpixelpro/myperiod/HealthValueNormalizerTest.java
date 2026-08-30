package com.playpixelpro.myperiod;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class HealthValueNormalizerTest {
    @Test
    public void menstrualFlowMapsOnlyKnownFlowLevels() {
        assertNull(HealthValueNormalizer.menstrualFlow(0));
        assertEquals("light", HealthValueNormalizer.menstrualFlow(1));
        assertEquals("medium", HealthValueNormalizer.menstrualFlow(2));
        assertEquals("heavy", HealthValueNormalizer.menstrualFlow(3));
        assertNull(HealthValueNormalizer.menstrualFlow(99));
    }

    @Test
    public void ovulationTestMapsSurgesAndSkipsInconclusiveValues() {
        assertNull(HealthValueNormalizer.ovulationTest(0));
        assertEquals("positive", HealthValueNormalizer.ovulationTest(1));
        assertEquals("positive", HealthValueNormalizer.ovulationTest(2));
        assertEquals("negative", HealthValueNormalizer.ovulationTest(3));
        assertNull(HealthValueNormalizer.ovulationTest(99));
    }
}
