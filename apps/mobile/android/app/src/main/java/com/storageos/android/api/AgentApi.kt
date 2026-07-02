package com.storageos.android.api

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.storageos.android.ui.devices.DeviceRecord
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface AgentApi {

    @GET("/health")
    suspend fun health(): HealthResponse

    @GET("/roots")
    suspend fun roots(): List<DriveInfo>

    @GET("/directory")
    suspend fun directory(@Query("path") path: String): List<DirectoryEntry>

    @POST("/devices/pair")
    suspend fun pairDevice(@Body request: PairDeviceRequest): PairDeviceResponse

    @GET("/devices")
    suspend fun listDevices(): List<DeviceRecord>

    companion object {
        fun create(host: String, port: Int): AgentApi {
            val client = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build()

            val json = Json { ignoreUnknownKeys = true }

            val retrofit = Retrofit.Builder()
                .baseUrl("http://$host:$port")
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()

            return retrofit.create(AgentApi::class.java)
        }
    }
}
