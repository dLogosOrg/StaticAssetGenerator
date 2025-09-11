class QueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.requestIdCounter = 0;
    this.head = 0;
    this.completedRequests = new Map();
    this.failedRequests = new Map();
  }

  addRequest(request) {
    const requestId = ++this.requestIdCounter;

    const queueItem = {
      id: requestId,
      templateType: request.templateType,
      props: request.props,
      handler: request.handler
    };

    this.queue.push(queueItem);
    console.log(`📝 Request ${requestId} queued. Queue length: ${this.queue.length - this.head}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processNext();
    }

    return requestId;
  }

  async processNext() {
    if (this.isProcessing || this.head >= this.queue.length) {
      return;
    }

    this.isProcessing = true;
    const queueItem = this.queue[this.head++];

    if (!queueItem) {
      console.error(`❌ No queue item found at index ${this.head}`);
      this.isProcessing = false;
      return;
    }
    
    console.log(`🔄 Processing request ${queueItem.id} (${queueItem.templateType})`);

    try {
      // handle image generation and storage
      const result = await queueItem.handler(queueItem.templateType, queueItem.props);
      console.log(`✅ Request ${queueItem.id} completed`);
      
      this.completedRequests.set(queueItem.id, result);
    } catch (error) {
      console.error(`❌ Request ${queueItem.id} failed:`, error.message);
      
      this.failedRequests.set(queueItem.id, error.message);
    } finally {
      this.isProcessing = false;
      this.preventUnboundedQueueGrowth()
      this.processNext();
    }
  }

  clearQueue() {
    this.queue = [];
    this.head = 0;
    console.log('🧹 Queue cleared');
  }

  preventUnboundedQueueGrowth() {
    if (this.head > 0 && this.head === this.queue.length) {
      this.clearQueue()
    } else if (this.head > 1024 && this.head * 2 > this.queue.length) {
      // shorten the queue to avoid unbounded growth
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
  }
}

// instantiate the singleton
export const queueService = new QueueService();
export default queueService;


