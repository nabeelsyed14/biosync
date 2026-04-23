package com.biosync.v2;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BioSyncHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

