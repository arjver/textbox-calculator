interface Variable {
    name: string;
    value: number;
}

class TextboxCalculator {
    private vars: Map<string, number> = new Map();
    private processed: Set<HTMLInputElement | HTMLTextAreaElement> = new Set();

    constructor() {
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
                        input.style.backgroundColor = '#e8f5e8';
                    } else {
                        input.style.backgroundColor = '#f8d7da';
                    }
                } catch (error) {
                    input.style.backgroundColor = '#f8d7da';
                }
            } else {
                input.style.backgroundColor = '#f8d7da';
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
        const mathPattern = /^[0-9+\-*/().\s\w]+$/;
        if (!mathPattern.test(mathExpr)) {
            return false;
        }
        if (/^\d+(\.\d+)?$/.test(mathExpr)) {
            return true;
        }
        const hasOperator = /[+\-*/]/.test(mathExpr);
        const hasNumber = /\d/.test(mathExpr);
        const hasVar = this.varused(mathExpr);
        const isValid = (hasOperator && (hasNumber || hasVar)) || hasVar || hasNumber;
        return isValid;
    }

    private varused(text: string): boolean {
        for (const varName of this.vars.keys()) {
            if (text.includes(varName)) {
                return true;
            }
        }
        return false;
    }

    private withVars(expr: string): number | null {
        let expression = expr;
        for (const [varName, value] of this.vars.entries()) {
            expression = expression.replace(new RegExp(`\b${varName}\b`, 'g'), value.toString());
        }
        const result = this.evalsafe(expression);
        return result;
    }

    private evalsafe(expr: string): number | null {
        const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
        try {
            const result = this.evalexp(sanitized);
            return result;
        } catch (error) {
            return null;
        }
    }

    private evalexp(expr: string): number | null {
        if (!expr || expr.trim() === '') {
            return null;
        }
        try {
            const cleanExpr = expr.replace(/\s/g, '');
            const result = this.parse(cleanExpr);
            return isNaN(result) ? null : result;
        } catch (error) {
            return null;
        }
    }

    private parse(expr: string): number {
        return this.add_sub(expr, { pos: 0 });
    }

    private add_sub(expr: string, ctx: { pos: number }): number {
        let result = this.mul_div(expr, ctx);
        while (ctx.pos < expr.length) {
            const op = expr[ctx.pos];
            if (op === '+' || op === '-') {
                ctx.pos++;
                const right = this.mul_div(expr, ctx);
                result = op === '+' ? result + right : result - right;
            } else {
                break;
            }
        }
        return result;
    }

    private mul_div(expr: string, ctx: { pos: number }): number {
        let result = this.factor(expr, ctx);
        while (ctx.pos < expr.length) {
            const op = expr[ctx.pos];
            if (op === '*' || op === '/') {
                ctx.pos++;
                const right = this.factor(expr, ctx);
                result = op === '*' ? result * right : result / right;
            } else {
                break;
            }
        }
        return result;
    }

    private factor(expr: string, ctx: { pos: number }): number {
        if (expr[ctx.pos] === '(') {
            ctx.pos++;
            const result = this.add_sub(expr, ctx);
            ctx.pos++;
            return result;
        }
        if (expr[ctx.pos] === '-') {
            ctx.pos++;
            return -this.factor(expr, ctx);
        }
        return this.num(expr, ctx);
    }

    private num(expr: string, ctx: { pos: number }): number {
        let start = ctx.pos;
        while (ctx.pos < expr.length && 
               (expr[ctx.pos].match(/[0-9.]/) || 
                (ctx.pos === start && expr[ctx.pos] === '-'))) {
            ctx.pos++;
        }
        const numStr = expr.substring(start, ctx.pos);
        const num = parseFloat(numStr);
        if (isNaN(num)) {
            throw new Error(`Invalid number: ${numStr}`);
        }
        return num;
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
            const originalExpr = input.dataset.originalExpression;
            if (originalExpr) {
                input.value = originalExpr;
                this.evalExpr(input);
            }
        });
    }
}

new TextboxCalculator();