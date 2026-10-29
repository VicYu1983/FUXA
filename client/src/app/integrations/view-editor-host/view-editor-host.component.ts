import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ProjectData } from '../../_models/project';
import { ProjectService } from '../../_services/project.service';
import { WindowRef } from '../../_helpers/windowref';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Component({
    selector: 'app-view-editor-host',
    templateUrl: './view-editor-host.component.html',
    styleUrls: ['./view-editor-host.component.scss']
})
export class ViewEditorHostComponent implements OnInit, OnDestroy {
    urlSafe: SafeResourceUrl;
    private baseline: string;
    private syncInProgress = false;
    private messageHandler = (event: MessageEvent) => this.onMessage(event);

    constructor(
        private sanitizer: DomSanitizer,
        private projectService: ProjectService,
        private router: Router,
        private winRef: WindowRef
    ) {
        const url = new URL('view-editor/', this.winRef.nativeWindow.document.baseURI);
        this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(url.toString());
    }

    ngOnInit() {
        this.winRef.nativeWindow.addEventListener('message', this.messageHandler);
    }

    ngOnDestroy() {
        this.winRef.nativeWindow.removeEventListener('message', this.messageHandler);
    }

    private onMessage(event: MessageEvent) {
        const currentWindow = this.winRef.nativeWindow;
        if (event.origin !== currentWindow.location.origin || !event.source) {
            return;
        }

        const sourceWindow = event.source as Window;
        let sourcePath: string;
        try {
            sourcePath = new URL(sourceWindow.location.href).pathname;
        } catch {
            return;
        }
        if (!/\/view-editor\/?$/.test(sourcePath)) {
            return;
        }

        const message: unknown = event.data;
        if (!isRecord(message) || message.source !== 'fuxa-view-editor' || message.protocol !== 1) {
            return;
        }

        if (message.type === 'ready') {
            const project = this.projectService.getProjectSnapshot();
            const revision = this.getRevision(project);
            this.baseline = revision;
            sourceWindow.postMessage({
                source: 'fuxa-host',
                protocol: 1,
                type: 'project',
                project,
                revision,
            }, event.origin);
            return;
        }

        if (message.type === 'sync-project') {
            void this.saveProject(sourceWindow, event.origin, message);
        }
    }

    private async saveProject(sourceWindow: Window, origin: string, message: Record<string, unknown>) {
        if (this.syncInProgress) {
            this.respond(sourceWindow, origin, false, '同步正在處理中，請稍候。');
            return;
        }

        if (!this.baseline || typeof message.revision !== 'string' || message.revision !== this.baseline) {
            this.respond(sourceWindow, origin, false, '同步版本無效，請重新開啟 View Editor。');
            return;
        }

        const currentProject = this.projectService.getProjectSnapshot();
        if (this.getRevision(currentProject) !== this.baseline) {
            this.respond(sourceWindow, origin, false, 'FUXA 專案在工具開啟後已有變更，為避免覆蓋資料，這次沒有同步。請重新開啟工具並載入最新專案。');
            return;
        }

        const incoming = message.project;
        if (!isRecord(incoming) || !isRecord(incoming.devices)
            || !isRecord(incoming.hmi) || !Array.isArray(incoming.hmi.views)) {
            this.respond(sourceWindow, origin, false, '工具傳回的專案格式無效，沒有套用任何變更。');
            return;
        }

        this.syncInProgress = true;
        try {
            const project = Object.assign(new ProjectData(), incoming);
            const savedProject = await this.projectService.replaceProjectAndSave(project);
            const revision = this.getRevision(savedProject);
            this.baseline = revision;
            sourceWindow.postMessage({
                source: 'fuxa-host',
                protocol: 1,
                type: 'sync-result',
                ok: true,
                project: savedProject,
                revision,
            }, origin);
            setTimeout(() => void this.router.navigate(['/editor']), 150);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.respond(sourceWindow, origin, false, `儲存專案失敗：${detail}`);
        } finally {
            this.syncInProgress = false;
        }
    }

    private respond(sourceWindow: Window, origin: string, ok: boolean, error: string) {
        sourceWindow.postMessage({
            source: 'fuxa-host',
            protocol: 1,
            type: 'sync-result',
            ok,
            error,
        }, origin);
    }

    private getRevision(project: ProjectData): string {
        return JSON.stringify({ appId: this.projectService.getAppId(), project });
    }
}
