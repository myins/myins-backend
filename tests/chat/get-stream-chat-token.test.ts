import { TestingModule } from '@nestjs/testing';
import { ChatController } from 'src/chat/chat.controller';
import { userMock } from 'tests/__mocks__/user';
import { getChatTestingModule } from './test-module';

describe('[ChatController] GET /token', () => {
  let chatController: ChatController;

  beforeEach(async () => {
    const module: TestingModule = await getChatTestingModule();
    chatController = module.get<ChatController>(ChatController);
  });

  test('[getStreamChatToken] return stream chat token', async () => {
    const result = await chatController.getStreamChatToken(userMock.id);

    expect(result).toHaveProperty('accessTokenStream');
    expect(result.accessTokenStream).toBeTruthy();
  });
});
