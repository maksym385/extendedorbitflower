class QueryBuilder {
    constructor(initialQuery = '') {
        this.expression = [];
        this.history = [];
        this.isEnabled = false;
        this.selectionUrl = '';
        this.initialQuery = initialQuery;
    }

    updateToggleButton() {
        resetFilter();
        const toggleInput = document.getElementById('queryToggle');
        const toggleSwitch = toggleInput.closest('.toggle-switch');
        const toggleLabel = toggleSwitch.querySelector('.toggle-label');

        this.isEnabled ? this.isEnabled = false : this.isEnabled = true;
        toggleLabel.textContent = this.isEnabled ? 'Querybuilding: Enabled' : 'Querybuilding: Disabled';
        console.log("Toggle State: " + this.isEnabled);
    }

    async initialize() {
        const response = await fetch('helpers/query-builder.html');
        const html = await response.text();

        const targetContainer = document.getElementById('query-builder');
        if (targetContainer) {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            targetContainer.appendChild(temp.firstChild);
        } else {
            console.error('Target container #query-builder not found');
        }
        this.setupEventListeners();
        this.setupEntityEventListeners();
        this.setupToggleButton();

        if (this.initialQuery) {
            this.expression = this.parseQueryString(this.initialQuery);
            for (let i = 0; i < this.expression.length; i++) {
                this.history.push(this.expression.slice(0, i));
            }
        }

        this.updateDisplay();

    }

    setupToggleButton() {
        const toggleInput = document.getElementById('queryToggle');
        const toggleSwitch = toggleInput.closest('.toggle-switch');
        const label = toggleSwitch.querySelector('.toggle-label');

        label.textContent = "Querybuilding : Disabled";

        toggleInput.addEventListener('change', () => {
            if (!window.opener || window.opener.closed) {
                alert('Querybuilding is not available! \n\nPlease open the visualization through the workflow engine connection.');
                toggleInput.checked = !toggleInput.checked;
                return;
            }
            this.updateToggleButton();
        });
    }

    setupEventListeners() {
        //Lot of duplicate functionality TODO Simplify
        const controls = document.querySelector('.query-controls');
        controls.addEventListener('click', (e) => {
            if (e.target.matches('.operator-btn')) {
                this.handleOperatorClick(e.target);
            } else if (e.target.matches('.paren-btn')) {
                this.handleParenClick(e.target);
            } else if (e.target.matches('.action-btn')) {
                this.handleActionClick(e.target);
            } else if (e.target.matches('.const-btn')) {
                //console.log("Handling all button click")
                this.handleAllClick(e.target);
            }
        });
    }

    setupEntityEventListeners() {
        const units = document.querySelectorAll('g.unit');
        units.forEach(unit => {
            unit.addEventListener('click', () => this.addToExpressionEntity(unit));
        });

        const roles = document.querySelectorAll('g.role');
        roles.forEach(role => {
            role.addEventListener('click', () => this.addToExpressionEntity(role));
        });
    }



    isValid(newelement) {
        if (this.expression.length === 0) {
            return !this.isOperator(newelement);
        }

        const lastElementArray = this.expression[this.expression.length - 1];
        const lastElement = lastElementArray[1];
        console.log(lastElement);

        if (this.isOperator(lastElement)) {
            return !this.isOperator(newelement) && newelement !== ')';
        }

        if (this.isEntity(lastElement) || lastElement === ')') {
            return this.isOperator(newelement) || newelement === ')';
        }

        if (lastElement === '(') {
            return !this.isOperator(newelement) && newelement !== ')';
        }

        if (lastElement === '¬') {
            return !this.isOperator(newelement) && newelement !== ')' && newelement !== '¬';
        }

        return true;
    }

    isOperator(element) {
        return ['OR', 'AND', '\\'].includes(element);
    }

    isEntity(element) {
        return !this.isOperator(element) &&
            !['(', ')', '¬'].includes(element);
    }

    handleOperatorClick(button) {
        const operator = button.textContent;
        this.addToExpression(operator);
    }

    handleParenClick(button) {
        const paren = button.textContent;
        this.addToExpression(paren);
    }

    handleAllClick() {

        this.addToExpressionEntity("ALL");
    }

    handleActionClick(button) {
        switch (button.id) {
            case 'undoBtn':
                this.undo();
                break;
            case 'clearBtn':
                this.clear();
                break;
            case 'evaluateBtn':
                this.evaluate();
                break;
        }
    }

    addToExpressionEntity(entity) {
        if (this.isEnabled) {
            console.log(entity);
            let expressionElement = [];
    
            if (entity === "ALL") {
                expressionElement[0] = "const";
                expressionElement[1] = "ALL";
            } else {
                const elementClass = entity.getAttribute('class');
                let entityname = '';
    
                if (this.isValid(entity)) {
                    if (elementClass === 'unit' || elementClass === 'role') {
                        let next = entity.nextElementSibling;
                        while (next && !next.classList.contains('btext')) {
                            next = next.nextElementSibling;
                        }
                        entityname = next ? next.textContent.trim() : '(Unnamed)';
                        expressionElement[0] = elementClass;
    
                    } else if (elementClass === 'subject') {
                        const labeltext = entity.querySelector('td.labeltext');
                        entityname = labeltext ? labeltext.textContent.trim() : '';
                        let uniqueId = entity.getAttribute('uniqueid');
                        expressionElement[0] = uniqueId;
                    }
    
                    expressionElement[1] = entityname;
                }
            }
    
            console.log(expressionElement);
            this.history.push([...this.expression]);
            this.expression.push(expressionElement);
            this.updateDisplay();
        }
    }
    

    addToExpression(item) {
        if (this.isEnabled) {
            if (this.isValid(item)) {
                console.log(item);
                let expressionElement = [];
                expressionElement[0] = 'op';
                expressionElement[1] = item;
                this.history.push([...this.expression]);
                this.expression.push(expressionElement);
                this.updateDisplay();
            }
        }

    }

    undo() {
        if (this.isEnabled) {
            if (this.history.length > 0) {
                this.expression = this.history.pop();
                this.updateDisplay();
            }
        }
    }

    clear() {
        if (this.isEnabled) {
            this.history.push([...this.expression]);
            this.expression = [];
            this.updateDisplay();
        }
    }

    fullClear() {
        this.history = [];
        this.expression = [];
        this.updateDisplay();
    }

    async evaluate() {
        //console.log("This is the expression: "+this.expression);

        if (!window.opener || window.opener.closed) {
            alert('Error: Connection to CPEE is not established!');
            return;
        }

        if (this.expression.length === 0) {
            alert('Error: Selection Query is Empty!');
            return;
        }



        try {
            const url = '/evaluate?'
            const queryString = this.buildQueryString();
            console.log("Query: " + queryString);
            const fullUrl = serverurl + url + queryString;
            const response = await fetch(fullUrl);

            if (!response.ok) {
                const errorText = await response.text();
                alert('Error: Malformed Query!');
                console.error(`Error evaluating QueryString: ${errorText}`);
                return { success: false, error: errorText };
            }
            const data = await response.text();

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "application/xml");

            const amount = xmlDoc.querySelectorAll("subject").length;

            window.opener.updateInputFromNewTab(serverurl + "/evaluate?" + queryString);
            alert('Success: Your Selection contains ' + amount + ' subjects.');
            return { success: true, data };
        } catch (error) {
            console.error('An error occurred evaluating the query string:', error);
            return { success: false, error: error.message };
        }
    }

    parseQueryString(queryString) {
        if (!queryString) return [];

        return queryString.split('&').map(pair => {
            const [key, value] = pair.split('=').map(decodeURIComponent);
            return [key, value];
        });
    }

    buildQueryString() {
        const queryString = this.expression.map(pair => pair.map(encodeURIComponent).join('=')).join('&');
        return queryString;
    }

    updateDisplay() {
        const display = document.getElementById('currentExpression');
        //console.log(this.expression);
        if (this.expression.length === 0) {
            display.textContent = "Enable the Querybuilder and leftclick Elements to build your selection!";
        } else {
            let nameList = [];
            for (let [type, name] of this.expression) {
                nameList.push(name);
            }

            display.textContent = nameList.join(' ');
        }

    }
}