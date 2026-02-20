#!/usr/bin/env python3
"""Test WebSocket connection to the orders endpoint"""

import asyncio
import websockets
import json

async def test_connection():
    uri = "ws://localhost:8000/ws/orders/"
    print(f"Attempting to connect to {uri}...")

    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            print("Waiting for messages (press Ctrl+C to stop)...")

            # Wait for any incoming messages
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"Received: {message}")
            except asyncio.TimeoutError:
                print("No messages received (this is normal if no orders are being created)")

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Connection failed with status code: {e.status_code}")
        print(f"   Headers: {e.headers}")
    except ConnectionRefusedError:
        print("❌ Connection refused. Is Daphne running on port 8000?")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(test_connection())
    except KeyboardInterrupt:
        print("\nTest stopped by user")
