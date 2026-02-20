import json
from channels.generic.websocket import AsyncWebsocketConsumer

class OrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'orders'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def order_message(self, event):
        """
        Receives message from the 'orders' group and sends it to the client.
        """
        message = event['message']
        await self.send(text_data=json.dumps(message))
