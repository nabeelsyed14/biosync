void setup() {
  // Start the serial connection at 9600 baud rate to communicate with the Raspberry Pi
  Serial.begin(9600);
}

void loop() {
  // Read the analog values from the MQ-135 and LDR
  // MQ-135 is connected to A0, LDR is connected to A1
  int mq135Value = analogRead(A0);
  int ldrValue = analogRead(A1);

  // Format the data as a JSON string so Python can parse it easily
  Serial.print("{\"mq\": ");
  Serial.print(mq135Value);
  Serial.print(", \"ldr\": ");
  Serial.print(ldrValue);
  Serial.println("}");

  // Send data every 500ms
  // The Pi reads it every 30 seconds but discards the buffer to get the freshest data
  delay(500);
}