package com.biosync.v2

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * BioSyncHealthPlugin
 *
 * A minimal, crash-safe Capacitor plugin that reads health data directly from
 * the Android Health Connect SDK. Replaces the @capgo/capacitor-health plugin
 * which was causing native JVM crashes on certain Android versions.
 *
 * Supports data from:
 *   - MI Band (via Zepp Life -> Health Connect sync)
 *   - Samsung Galaxy Watch (via Samsung Health -> Health Connect sync)
 *   - Any other Health Connect compatible device
 */
@CapacitorPlugin(name = "BioSyncHealth")
class BioSyncHealthPlugin : Plugin() {

    /**
     * Check if Health Connect is available on this device/Android version.
     * Returns: { available: boolean, status: number }
     */
    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            val result = JSObject()
            result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
            result.put("status", status)
            call.resolve(result)
        } catch (e: Exception) {
            // On some devices getSdkStatus itself can throw — treat as unavailable
            val result = JSObject()
            result.put("available", false)
            result.put("status", -1)
            result.put("error", e.message)
            call.resolve(result)
        }
    }

    /**
     * Sync today's health data from Health Connect.
     * Reads Steps, Heart Rate, and Sleep in a single call.
     * Each metric is fetched independently — if one fails the others still return.
     *
     * Returns: { steps: number, heartRate: number, sleepHours: number }
     *
     * IMPORTANT: Permissions must already be granted via Health Connect settings.
     * This method does NOT request permissions (which caused crashes in the Capgo plugin).
     */
    @PluginMethod
    fun syncToday(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val now = Instant.now()
                val todayStart = LocalDate.now()
                    .atStartOfDay(ZoneId.systemDefault())
                    .toInstant()

                // ---- Steps ----
                var steps = 0L
                try {
                    val stepsAgg = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(todayStart, now)
                        )
                    )
                    steps = stepsAgg[StepsRecord.COUNT_TOTAL] ?: 0L
                } catch (e: Exception) {
                    // Steps not available or not authorized — return 0
                }

                // ---- Heart Rate (Latest within 24 hours) ----
                var heartRate = 0
                val twentyFourHoursAgo = Instant.now().minusSeconds(24 * 3600)
                try {
                    val hrResponse = client.readRecords(
                        ReadRecordsRequest(
                            recordType = HeartRateRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(twentyFourHoursAgo, now)
                        )
                    )
                    if (hrResponse.records.isNotEmpty()) {
                        val latestRecord = hrResponse.records.last()
                        if (latestRecord.samples.isNotEmpty()) {
                            heartRate = latestRecord.samples.last().beatsPerMinute.toInt()
                        }
                    }
                } catch (e: Exception) {
                    // HR not available or not authorized
                }

                // ---- Sleep (last 36h window to catch late-syncing data) ----
                var sleepHours = 0.0
                try {
                    val sleepStart = Instant.now().minusSeconds(36 * 3600)
                    val sleepResponse = client.readRecords(
                        ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(sleepStart, now)
                        )
                    )
                    for (session in sleepResponse.records) {
                        val durationMs = session.endTime.toEpochMilli() - session.startTime.toEpochMilli()
                        sleepHours += durationMs.toDouble() / (1000.0 * 60.0 * 60.0)
                    }
                    // Round to 1 decimal place
                    sleepHours = Math.round(sleepHours * 10.0).toDouble() / 10.0
                } catch (e: Exception) {
                    // Sleep not available or not authorized
                }

                // ---- SpO2 / Blood Oxygen (Latest within 24 hours) ----
                var spo2 = 0.0
                try {
                    val spo2Response = client.readRecords(
                        ReadRecordsRequest(
                            recordType = OxygenSaturationRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(twentyFourHoursAgo, now)
                        )
                    )
                    if (spo2Response.records.isNotEmpty()) {
                        spo2 = spo2Response.records.last().percentage.value
                    }
                } catch (e: Exception) {
                    // SpO2 not available or not authorized
                }

                // ---- HRV / Stress Proxy (Average last 24 hours) ----
                var hrv = 0.0
                try {
                    val hrvResponse = client.readRecords(
                        ReadRecordsRequest(
                            recordType = HeartRateVariabilityRmssdRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(twentyFourHoursAgo, now)
                        )
                    )
                    if (hrvResponse.records.isNotEmpty()) {
                        var totalHrv = 0.0
                        var count = 0
                        for (record in hrvResponse.records) {
                            totalHrv += record.heartRateVariabilityMillis
                            count++
                        }
                        if (count > 0) {
                            hrv = totalHrv / count
                        }
                    }
                } catch (e: Exception) {
                    // HRV not available
                }

                val result = JSObject()
                result.put("steps", steps)
                result.put("heartRate", heartRate)
                result.put("sleepHours", sleepHours)
                result.put("spo2", spo2)
                result.put("hrv", hrv)
                call.resolve(result)

            } catch (e: Exception) {
                // Top-level catch — should never reach here but ensures the app never crashes
                call.reject("Health sync failed: ${e.message}", e)
            }
        }
    }
}
