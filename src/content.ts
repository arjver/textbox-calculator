interface Variable {
    name: string;
    value: number;
}

class TextboxCalculator {
    private vars: Map<string, number> = new Map();
    private processed: Set<HTMLInputElement | HTMLTextAreaElement> = new Set();
    private functions: Map<string, Function> = new Map();

    constructor() {
        this.initFns();
        this.load().then(() => {
            this.initInputs();
            this.setupListener();
        });
    }

    private async load() {
        const result = await chrome.storage.sync.get('variables');
        if (result.variables) {
            this.vars = new Map<string, number>(
                Object.entries(result.variables)
            );
        }
    }

    private initInputs() {
        this.process();
        const observer = new MutationObserver(() => {
            this.process();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private process() {
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach((input) => {
            if (!this.processed.has(input as HTMLInputElement | HTMLTextAreaElement)) {
                this.addCalc(input as HTMLInputElement | HTMLTextAreaElement);
            }
        });
    }

    private addCalc(input: HTMLInputElement | HTMLTextAreaElement) {
        this.processed.add(input);
        input.addEventListener('focus', () => {
            this.restore(input);
        });
        input.addEventListener('blur', () => {
            this.evalExpr(input);
        });
    }

    private evalExpr(input: HTMLInputElement | HTMLTextAreaElement) {
        const expr = input.value.trim();
        if (this.ismath(expr)) {
            const mathExpr = expr.substring(1).trim();
            input.dataset.originalExpression = expr;
            if (this.isvalid(mathExpr)) {
                try {
                    const result = this.withVars(mathExpr);
                    if (result !== null) {
                        input.value = result.toString();
                        input.style.backgroundColor = 'rgb(230, 245, 230)';
                    } else {
                        input.style.backgroundColor = 'rgb(250, 215, 220)';
                    }
                } catch (error) {
                    input.style.backgroundColor = 'rgb(250, 215, 220)';
                }
                } else {
                    input.style.backgroundColor = 'rgb(250, 215, 220)';
                }
        } else {
            input.style.backgroundColor = '';
        }
    }

    private restore(input: HTMLInputElement | HTMLTextAreaElement) {
        const originalExpr = input.dataset.originalExpression;
        if (originalExpr) {
            input.value = originalExpr;
            input.style.backgroundColor = '';
        }
    }

    private ismath(expr: string): boolean {
        if (!expr.startsWith('=')) {
            return false;
        }
        return true;
    }

    private isvalid(mathExpr: string): boolean {
        if (mathExpr === '') {
            return false;
        }
        const mathPattern = /^[0-9+\-*/().,\s\w<>=!&|^]+$/; // TODO actually test this
        if (!mathPattern.test(mathExpr)) {
            return false;
        }
        if (/^\d+(\.\d+)?$/.test(mathExpr)) { // TODO actually test this
            return true;
        }
        const hasOperator = /[+\-*/]/.test(mathExpr);
        const hasNumber = /\d/.test(mathExpr);
        const hasVar = this.varused(mathExpr);
        const hasFunction = this.functionused(mathExpr);
        const isValid = (hasOperator && (hasNumber || hasVar || hasFunction)) || hasVar || hasNumber || hasFunction;
        return isValid;
    }

    private varused(text: string): boolean {
        for (const v of this.vars.keys()) {
            const regex = new RegExp(`\\b${v}\\b`);
            if (regex.test(text)) {
                return true;
            }
        }
        return false;
    }

    private functionused(text: string): boolean {
        for (const funcName of this.functions.keys()) {
            const regex = new RegExp(`\\b${funcName}\\s*\\(`, 'i');
            if (regex.test(text)) {
                return true;
            }
        }
        return false;
    }

    private withVars(expr: string): number | null {
        let expression = expr;
        console.log('Before variable replacement:', expression, 'Available vars:', Array.from(this.vars.entries()));
        
        for (const [varName, value] of this.vars.entries()) {
            expression = expression.replace(new RegExp(`\\b${varName}\\b`, 'g'), value.toString());
        }
        console.log('After variable replacement:', expression);
        
        const result = this.neweval(expression);
        return result;
    }


    // private evalsafe(expr: string): number | null {
    //     try {
    //         const result = this.evalAdvanced(expr);
    //         return result;
    //     } catch (error) {
    //         return null;
    //     }
    // }

    private neweval(expr: string): number | null {
        if (!expr || expr.trim() === '') {
            return null;
        }
        try {
            const cleanExpr = expr.replace(/\s/g, '');
            const result = this.parseExp(cleanExpr);
            return isNaN(result) ? null : result;
        } catch (error) {
            console.error('Expression evaluation error:', error);
            return null;
        }
    }

    private parseExp(expr: string): number {
        const tokens = this.tokenize(expr);
        return this.parseTokens(tokens);
    }

    private tokenize(expr: string): string[] {
        const tokens: string[] = [];
        let i = 0;
        
        while (i < expr.length) {
            const char = expr[i];
            
            if (/\d/.test(char) || char === '.') {
                let num = '';
                while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
                    num += expr[i];
                    i++;
                }
                tokens.push(num);
            } else if (/[a-zA-Z]/.test(char)) {
                let name = '';
                while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
                    name += expr[i];
                    i++;
                }
                tokens.push(name.toUpperCase());
            } else if ('+-*/(),%<>=!&|^'.includes(char)) {
                if (char === '<' && i + 1 < expr.length && expr[i + 1] === '=') {
                    tokens.push('<=');
                    i += 2;
                } else if (char === '>' && i + 1 < expr.length && expr[i + 1] === '=') {
                    tokens.push('>=');
                    i += 2;
                } else if (char === '=' && i + 1 < expr.length && expr[i + 1] === '=') {
                    tokens.push('==');
                    i += 2;
                } else if (char === '!' && i + 1 < expr.length && expr[i + 1] === '=') {
                    tokens.push('!=');
                    i += 2;
                } else if (char === '&' && i + 1 < expr.length && expr[i + 1] === '&') {
                    tokens.push('&&');
                    i += 2;
                } else if (char === '|' && i + 1 < expr.length && expr[i + 1] === '|') {
                    tokens.push('||');
                    i += 2;
                } else {
                    tokens.push(char);
                    i++;
                }
            } else {
                i++;
            }
        }
        
        return tokens;
    }

    private parseTokens(tokens: string[]): number {
        return this.comparisons(tokens, { pos: 0 });
    }

    private comparisons(tokens: string[], ctx: { pos: number }): number {
        // note: this currently just returns 1 or 0, might want to change to true/false str?
        let result = this.parseLogical(tokens, ctx);
        
        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
                ctx.pos++;
                const right = this.parseLogical(tokens, ctx);
                switch (op) {
                    case '<': result = result < right ? 1 : 0; break;
                    case '>': result = result > right ? 1 : 0; break;
                    case '<=': result = result <= right ? 1 : 0; break;
                    case '>=': result = result >= right ? 1 : 0; break;
                    case '==': result = result === right ? 1 : 0; break;
                    case '!=': result = result !== right ? 1 : 0; break;
                }
            } else {
                break;
            }
        }
        
        return result;
    }

    private parseLogical(tokens: string[], ctx: { pos: number }): number {
        let result = this.add_sub_new(tokens, ctx);
        
        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (['&&', '||'].includes(op)) {
                ctx.pos++;
                const right = this.add_sub_new(tokens, ctx);
                switch (op) {
                    case '&&': result = (result && right) ? 1 : 0; break;
                    case '||': result = (result || right) ? 1 : 0; break;
                }
            } else {
                break;
            }
        }
        
        return result;
    }

    private add_sub_new(tokens: string[], ctx: { pos: number }): number {
        let result = this.mul_div_new(tokens, ctx);
        
        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (op === '+' || op === '-') {
                ctx.pos++;
                const right = this.mul_div_new(tokens, ctx);
                result = op === '+' ? result + right : result - right;
            } else {
                break;
            }
        }
        
        return result;
    }

    private mul_div_new(tokens: string[], ctx: { pos: number }): number {
        let result = this.power(tokens, ctx);
        
        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (op === '*' || op === '/' || op === '%') {
                ctx.pos++;
                const right = this.power(tokens, ctx);
                if (op === '*') {
                    result = result * right;
                } else if (op === '/') {
                    result = result / right;
                } else {
                    result = result % right;
                }
            } else {
                break;
            }
        }
        
        return result;
    }

    private power(tokens: string[], ctx: { pos: number }): number {
        let result = this.factor_new(tokens, ctx);
        
        while (ctx.pos < tokens.length && tokens[ctx.pos] === '^') {
            ctx.pos++;
            const right = this.factor_new(tokens, ctx);
            result = Math.pow(result, right);
        }
        
        return result;
    }

    private factor_new(tokens: string[], ctx: { pos: number }): number {
        if (ctx.pos >= tokens.length) {
            throw new Error('Unexpected end of expression');
        }
        
        const token = tokens[ctx.pos];
        
        if (token === '(') {
            ctx.pos++;
            const result = this.comparisons(tokens, ctx);
            if (ctx.pos >= tokens.length || tokens[ctx.pos] !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            ctx.pos++;
            return result;
        }
        
        if (token === '-') {
            ctx.pos++;
            return -this.factor_new(tokens, ctx);
        }
        
        if (token === '+') {
            ctx.pos++;
            return this.factor_new(tokens, ctx);
        }
        
        if (/^\d+(\.\d+)?$/.test(token)) {
            ctx.pos++;
            return parseFloat(token);
        }
        
        if (this.functions.has(token)) {
            ctx.pos++;
            if (ctx.pos < tokens.length && tokens[ctx.pos] === '(') {
                return this.parseFn(token, tokens, ctx);
            } else {
                return this.functions.get(token)!();
            }
        }
        
        throw new Error(`Unknown token: ${token}`);
    }

    private parseFn(funcName: string, tokens: string[], ctx: { pos: number }): number {
        ctx.pos++;
        const args: number[] = [];
        
        if (ctx.pos < tokens.length && tokens[ctx.pos] === ')') {
            ctx.pos++;
            return this.functions.get(funcName)!();
        }
        
        while (ctx.pos < tokens.length) {
            args.push(this.comparisons(tokens, ctx));
            
            if (ctx.pos < tokens.length && tokens[ctx.pos] === ',') {
                ctx.pos++;
            } else if (ctx.pos < tokens.length && tokens[ctx.pos] === ')') {
                ctx.pos++;
                break;
            } else {
                throw new Error('Expected comma or closing parenthesis in function call');
            }
        }
        
        return this.functions.get(funcName)!(...args);
    }

    // need an actual tokenizer and parser now
    // private evalexp(expr: string): number | null {
    //     if (!expr || expr.trim() === '') {
    //         return null;
    //     }
    //     try {
    //         const cleanExpr = expr.replace(/\s/g, '');
    //         const result = this.parse(cleanExpr);
    //         return isNaN(result) ? null : result;
    //     } catch (error) {
    //         return null;
    //     }
    // }

    // private parse(expr: string): number {
    //     return this.add_sub(expr, { pos: 0 });
    // }

    // old fns, not used anymore
    // private add_sub(expr: string, ctx: { pos: number }): number {
    //     let result = this.mul_div(expr, ctx);
    //     while (ctx.pos < expr.length) {
    //         const op = expr[ctx.pos];
    //         if (op === '+' || op === '-') {
    //             ctx.pos++;
    //             const right = this.mul_div(expr, ctx);
    //             result = op === '+' ? result + right : result - right;
    //         } else {
    //             break;
    //         }
    //     }
    //     return result;
    // }

    // private mul_div(expr: string, ctx: { pos: number }): number {
    //     let result = this.factor(expr, ctx);
    //     while (ctx.pos < expr.length) {
    //         const op = expr[ctx.pos];
    //         if (op === '*' || op === '/') {
    //             ctx.pos++;
    //             const right = this.factor(expr, ctx);
    //             result = op === '*' ? result * right : result / right;
    //         } else {
    //             break;
    //         }
    //     }
    //     return result;
    // }

    // private factor(expr: string, ctx: { pos: number }): number {
    //     if (expr[ctx.pos] === '(') {
    //         ctx.pos++;
    //         const result = this.add_sub(expr, ctx);
    //         ctx.pos++;
    //         return result;
    //     }
    //     if (expr[ctx.pos] === '-') {
    //         ctx.pos++;
    //         return -this.factor(expr, ctx);
    //     }
    //     return this.num(expr, ctx);
    // }

    // private num(expr: string, ctx: { pos: number }): number {
    //     let start = ctx.pos;
    //     while (ctx.pos < expr.length && 
    //            (expr[ctx.pos].match(/[0-9.]/) || 
    //             (ctx.pos === start && expr[ctx.pos] === '-'))) {
    //         ctx.pos++;
    //     }
    //     const numStr = expr.substring(start, ctx.pos);
    //     const num = parseFloat(numStr);
    //     if (isNaN(num)) {
    //         throw new Error(`Invalid number: ${numStr}`);
    //     }
    //     return num;
    // }

    private initFns() {
        this.functions.set('ABS', (x: number) => Math.abs(x));
        this.functions.set('SQRT', (x: number) => Math.sqrt(x));
        this.functions.set('POWER', (x: number, y: number) => Math.pow(x, y));
        this.functions.set('POW', (x: number, y: number) => Math.pow(x, y));
        this.functions.set('EXP', (x: number) => Math.exp(x));
        this.functions.set('LN', (x: number) => Math.log(x));
        this.functions.set('LOG', (x: number, base: number = 10) => Math.log(x) / Math.log(base));
        this.functions.set('LOG10', (x: number) => Math.log10(x));
        this.functions.set('LOG2', (x: number) => Math.log2(x));
        
        this.functions.set('SIN', (x: number) => Math.sin(x));
        this.functions.set('COS', (x: number) => Math.cos(x));
        this.functions.set('TAN', (x: number) => Math.tan(x));
        this.functions.set('ASIN', (x: number) => Math.asin(x));
        this.functions.set('ACOS', (x: number) => Math.acos(x));
        this.functions.set('ATAN', (x: number) => Math.atan(x));
        this.functions.set('ATAN2', (y: number, x: number) => Math.atan2(y, x));
        this.functions.set('SINH', (x: number) => Math.sinh(x));
        this.functions.set('COSH', (x: number) => Math.cosh(x));
        this.functions.set('TANH', (x: number) => Math.tanh(x));
        
        this.functions.set('ROUND', (x: number, digits: number = 0) => Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits));
        this.functions.set('ROUNDUP', (x: number, digits: number = 0) => Math.ceil(x * Math.pow(10, digits)) / Math.pow(10, digits));
        this.functions.set('ROUNDDOWN', (x: number, digits: number = 0) => Math.floor(x * Math.pow(10, digits)) / Math.pow(10, digits));
        this.functions.set('CEILING', (x: number, significance: number = 1) => Math.ceil(x / significance) * significance);
        this.functions.set('FLOOR', (x: number, significance: number = 1) => Math.floor(x / significance) * significance);
        this.functions.set('INT', (x: number) => Math.floor(x));
        this.functions.set('TRUNC', (x: number, digits: number = 0) => Math.trunc(x * Math.pow(10, digits)) / Math.pow(10, digits));
        
        this.functions.set('MIN', (...args: number[]) => Math.min(...args));
        this.functions.set('MAX', (...args: number[]) => Math.max(...args));
        this.functions.set('SUM', (...args: number[]) => args.reduce((sum, val) => sum + val, 0));
        this.functions.set('AVERAGE', (...args: number[]) => args.reduce((sum, val) => sum + val, 0) / args.length);
        this.functions.set('MEAN', (...args: number[]) => args.reduce((sum, val) => sum + val, 0) / args.length);
        this.functions.set('COUNT', (...args: number[]) => args.length);
        this.functions.set('MEDIAN', (...args: number[]) => {
            const sorted = args.sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        });
        this.functions.set('MODE', (...args: number[]) => {
            const freq: Map<number, number> = new Map();
            let maxfreq = 0;
            let mode = args[0];
            for (const num of args) {
                const count = (freq.get(num) || 0) + 1;
                freq.set(num, count);
                if (count > maxfreq) {
                    maxfreq = count;
                    mode = num;
                }
            }
            return mode;
        });
        this.functions.set('STDEV', (...args: number[]) => {
            const mean = args.reduce((sum, val) => sum + val, 0) / args.length;
            const variance = args.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (args.length - 1);
            return Math.sqrt(variance);
        });
        this.functions.set('VAR', (...args: number[]) => {
            const mean = args.reduce((sum, val) => sum + val, 0) / args.length;
            return args.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (args.length - 1);
        });
        
        this.functions.set('IF', (condition: boolean, trueValue: number, falseValue: number) => condition ? trueValue : falseValue);
        this.functions.set('AND', (...args: boolean[]) => args.every(x => x));
        this.functions.set('OR', (...args: boolean[]) => args.some(x => x));
        this.functions.set('NOT', (x: boolean) => !x);
        
        this.functions.set('PMT', (rate: number, nper: number, pv: number, fv: number = 0, type: number = 0) => {
            if (rate === 0) return -(pv + fv) / nper;
            const pvif = Math.pow(1 + rate, nper);
            return -(rate * (pv * pvif + fv)) / ((pvif - 1) * (1 + rate * type));
        });
        this.functions.set('PV', (rate: number, nper: number, pmt: number, fv: number = 0, type: number = 0) => {
            if (rate === 0) return -pmt * nper - fv;
            const pvif = Math.pow(1 + rate, nper);
            return -(pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv) / pvif;
        });
        this.functions.set('FV', (rate: number, nper: number, pmt: number, pv: number = 0, type: number = 0) => {
            if (rate === 0) return -pv - pmt * nper;
            const pvif = Math.pow(1 + rate, nper);
            return -(pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate));
        });
        
        this.functions.set('PI', () => Math.PI);
        this.functions.set('E', () => Math.E);
        
        this.functions.set('RAND', () => Math.random());
        this.functions.set('RANDBETWEEN', (bottom: number, top: number) => Math.floor(Math.random() * (top - bottom + 1)) + bottom);
        
        this.functions.set('SIGN', (x: number) => Math.sign(x));
        this.functions.set('MOD', (x: number, y: number) => x % y);
        this.functions.set('GCD', (a: number, b: number) => {
            while (b !== 0) {
                const temp = b;
                b = a % b;
                a = temp;
            }
            return Math.abs(a);
        });
        this.functions.set('LCM', (a: number, b: number) => Math.abs(a * b) / this.functions.get('GCD')!(a, b));
        
        this.functions.set('FACT', (n: number) => {
            if (n < 0 || !Number.isInteger(n)) throw new Error('Factorial requires non-negative integer');
            let result = 1;
            for (let i = 2; i <= n; i++) result *= i;
            return result;
        });
        
        this.functions.set('COMBIN', (n: number, k: number) => {
            if (k > n || k < 0 || !Number.isInteger(n) || !Number.isInteger(k)) return 0;
            return this.functions.get('FACT')!(n) / (this.functions.get('FACT')!(k) * this.functions.get('FACT')!(n - k));
        });
        this.functions.set('PERMUT', (n: number, k: number) => {
            if (k > n || k < 0 || !Number.isInteger(n) || !Number.isInteger(k)) return 0;
            return this.functions.get('FACT')!(n) / this.functions.get('FACT')!(n - k);
        });
        
        this.functions.set('TODAY', () => Math.floor(Date.now() / (1000 * 60 * 60 * 24)));
        this.functions.set('NOW', () => Date.now() / (1000 * 60 * 60 * 24));
        
        this.functions.set('LEN', (text: any) => String(text).length);
        
        this.functions.set('DEGREES', (radians: number) => radians * (180 / Math.PI));
        this.functions.set('RADIANS', (degrees: number) => degrees * (Math.PI / 180));
        this.functions.set('EVEN', (x: number) => Math.ceil(x / 2) * 2);
        this.functions.set('ODD', (x: number) => {
            const rounded = Math.ceil(Math.abs(x));
            return rounded % 2 === 0 ? rounded + 1 : rounded;
        });
        
        this.functions.set('GEOMEAN', (...args: number[]) => {
            const product = args.reduce((prod, val) => prod * val, 1);
            return Math.pow(product, 1 / args.length);
        });
        this.functions.set('HARMEAN', (...args: number[]) => {
            const reciprocalSum = args.reduce((sum, val) => sum + (1 / val), 0);
            return args.length / reciprocalSum;
        });
        
        this.functions.set('ISNUMBER', (value: any) => typeof value === 'number' && !isNaN(value) ? 1 : 0);
        this.functions.set('ISEVEN', (x: number) => x % 2 === 0 ? 1 : 0);
        this.functions.set('ISODD', (x: number) => x % 2 !== 0 ? 1 : 0);
    }

    private setupListener() {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === 'variablesUpdated') {
                this.vars = new Map(Object.entries(msg.variables));
                this.updateAll();
            }
        });
    }

    private updateAll() {
        this.processed.forEach((input) => {
            const original = input.dataset.originalExpression;
            if (original) {
                input.value = original;
                this.evalExpr(input);
            }
        });
    }
}

new TextboxCalculator();