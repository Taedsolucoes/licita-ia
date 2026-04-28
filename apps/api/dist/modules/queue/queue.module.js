"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = exports.QUEUE_NAMES = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
exports.QUEUE_NAMES = {
    MATCHING: 'matching',
    REPORTS: 'reports',
    NOTIFICATIONS: 'notifications',
    CAPAG_SYNC: 'capag-sync',
    BIDDING_INGEST: 'bidding-ingest',
};
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    connection: {
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                        password: configService.get('REDIS_PASSWORD') || undefined,
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({ name: exports.QUEUE_NAMES.MATCHING }, { name: exports.QUEUE_NAMES.REPORTS }, { name: exports.QUEUE_NAMES.NOTIFICATIONS }, { name: exports.QUEUE_NAMES.CAPAG_SYNC }, { name: exports.QUEUE_NAMES.BIDDING_INGEST }),
        ],
        exports: [bullmq_1.BullModule],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map