var configLogLevel = 'debug';
export class LogConsole{

    static checkLevle(_level:string) {
        let level = ['trace','debug','info','warn','error','fatal'];
        let configIndex = 0;
        for(let i=0;i<level.length;i++){
            if(configLogLevel == level[i]) {
                configIndex = i;
                break;
            }
        }

        let levelIndex = 0;
        for(let i=0;i<level.length;i++){
            if(_level == level[i]) {
                levelIndex = i;
                break;
            }
        }

        if(levelIndex >= configIndex) {
            return true;
        }
        return false;
    }

    static output(_level:string, ...args:any[]) {
        if(!LogConsole.checkLevle(_level)) {
            return;
        }
        console.log('['+_level+'] ', ...args);

    }
    static trace(...args:any[]) {
        LogConsole.output('trace',args);
    }
    static debug(...args:any[]) {
        LogConsole.output('debug',args);
    }
    static info(...args:any[]) {
        LogConsole.output('info',args);
    }
    static warn(...args:any[]) {
        LogConsole.output('warn',args);
    }
    static error(...args:any[]) {
        LogConsole.output('error',args);
    }
    static fatal(...args:any[]) {
        LogConsole.output('fatal',args);
    }

}
