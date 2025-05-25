let unitsList = [];
let rolesList = [];

// Tab Creation Functions
function createInitialTabStructure(tabId) {
    uniqueid = tabId.split('-subject-')[1];
    if (tabId === "default") {
        uniqueid = "default";
    }
    const container = document.createElement('div');
    container.className = 'subject-editor';

    const nameInputContainer = document.createElement('div');
    nameInputContainer.className = 'input-container';

    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', `subject-name-input-${uniqueid}`);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `subject-name-input-${uniqueid}`;
    nameInput.placeholder = 'Enter subject name';
    nameInput.className = 'subject-name-input';

    nameInputContainer.appendChild(nameLabel);
    nameInputContainer.appendChild(nameInput);
    container.appendChild(nameInputContainer);

    const unitRolesContainer = document.createElement('div');
    unitRolesContainer.className = 'unit-roles-container';
    unitRolesContainer.id = `unit-roles-container-${uniqueid}`;
    container.appendChild(unitRolesContainer);

    const addUnitButton = document.createElement('button');
    addUnitButton.textContent = '+ Add Unit Relation';
    addUnitButton.className = 'add-unit-button';
    addUnitButton.onclick = () => {
        const newUnitRow = createUnitRow(uniqueid, unitRolesContainer.children.length - 1);
        unitRolesContainer.appendChild(newUnitRow);
        populateUnitDropdowns();
        populateRoleDropdowns();
    };
    unitRolesContainer.appendChild(addUnitButton);

    const firstUnitRow = createUnitRow(uniqueid, 0);
    unitRolesContainer.appendChild(firstUnitRow);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = `editor-save-button-subject-${uniqueid}`;
    saveButton.onclick = () => {
        //console.log("Saving Subject with ID: "+ uniqueid);
        id = saveButton.className.split("editor-save-button-subject-")[1];
        //console.log("Actual ID Used: "+id);
        saveSubject(id);
        //using saveSubject(uniqueid) when edit window is open and clear is pressed on Add Subject Tab,
        //pressing save in edit tab calls saveSubject("default") istead of saveSubject("uniqueID") and i don't know why,
        //but this solution works, i think
    };
    if (uniqueid === "default") {
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        clearButton.className = `editor-clear-button-subject-${uniqueid}`;
        clearButton.onclick = () => {
            loadAddSubjectTab();
            populateUnitDropdowns();
            populateRoleDropdowns();
            switchToGraphTab();
        };
        buttonContainer.appendChild(clearButton);
    }


    buttonContainer.appendChild(saveButton);
    container.appendChild(buttonContainer);
    return container;
}

function createUnitRow(uniqueid, unitIndex) {
    const unitRow = document.createElement('div');
    unitRow.className = 'unit-row';
    unitRow.id = `unit-row-${uniqueid}-${unitIndex}`;

    const unitSelect = document.createElement('select');
    unitSelect.className = 'unit-select';
    unitSelect.id = `unit-select-${uniqueid}-${unitIndex}`;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Unit';
    unitSelect.appendChild(defaultOption);

    unitRow.appendChild(unitSelect);

    const rolesContainer = document.createElement('div');
    rolesContainer.className = 'roles-container';
    rolesContainer.id = `roles-container-${uniqueid}-${unitIndex}`;

    const firstRoleRow = createRoleRow(uniqueid, unitIndex, 0);
    rolesContainer.appendChild(firstRoleRow);

    unitRow.appendChild(rolesContainer);


    if (unitIndex >= 0) {
        const removeUnitButton = document.createElement('button');
        removeUnitButton.textContent = '- Remove Unit Relation';
        removeUnitButton.className = 'remove-unit-button';
        removeUnitButton.onclick = () => {
            unitRow.remove();
        };
        unitRow.appendChild(removeUnitButton);
    }

    return unitRow;
}

function createRoleRow(uniqueid, unitIndex, roleIndex) {
    const roleRow = document.createElement('div');
    roleRow.className = 'role-row';
    roleRow.id = `role-row-${uniqueid}-${unitIndex}-${roleIndex}`;

    const roleDropdown = document.createElement('select');
    roleDropdown.className = 'role-dropdown';
    roleDropdown.id = `role-dropdown-${uniqueid}-${unitIndex}-${roleIndex}`;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Role';
    roleDropdown.appendChild(defaultOption);

    roleRow.appendChild(roleDropdown);

    let button = document.createElement('button');
    if (roleIndex === 0) {
        button.textContent = '+';
        button.className = 'add-role-button';
        button.onclick = () => {
            const rolesContainer = roleRow.closest('.roles-container');
            const newRoleRow = createRoleRow(uniqueid, unitIndex, rolesContainer.children.length);
            rolesContainer.appendChild(newRoleRow);
            populateRoleDropdowns();
        };
    } else {
        button.textContent = '−';
        button.className = 'remove-role-button';
        button.onclick = () => {
            roleRow.remove();
        };
    }

    roleRow.appendChild(button);

    return roleRow;
}

// Loading Functions
function loadAddSubjectTab() {
    var insarea = document.querySelector('ui-area[data-belongs-to-tab=addsubject]');
    insarea.innerHTML = '';
    var initialTabStructure = createInitialTabStructure("default");
    insarea.appendChild(initialTabStructure);
}

async function loadUnits() {
    try {
        const response = await fetch('/get/units');
        const fetchedUnits = await response.json();
        unitsList = fetchedUnits;
    } catch (error) {
        console.error('Error loading units:', error);
    }
}

async function loadRoles() {
    try {
        const response = await fetch('/get/roles');
        const fetchedRoles = await response.json();
        rolesList = fetchedRoles;
    } catch (error) {
        console.error('Error loading roles:', error);
    }
}

async function populateEditSubjectTab(tabId) {
    const elementId = tabId.split('-subject-')[1];
    //console.log("Populating Edit tab for ID: "+elementId);

    try {
        const response = await getRelations(elementId);
        if (!response.success) {
            console.error('Failed to fetch relations:', response.error);
            return;
        }
        const { name, relations } = response.data;

        $(`#subject-name-input-${elementId}`).val(name);
        await populateRoleDropdowns();
        await populateUnitDropdowns();
        let unitIndex = 0;
        for (const [unitName, roles] of Object.entries(relations)) {

            let unitSelect;
            if (unitIndex === 0) {
                unitSelect = $(`#unit-select-${elementId}-${unitIndex}`);
                unitSelect.val(unitName);
            } else {
                const addUnitButton = $(`#unit-roles-container-${elementId} .add-unit-button`);
                addUnitButton.click();

                unitSelect = $(`#unit-select-${elementId}-${unitIndex}`);
                unitSelect.val(unitName);
            }

            let roleIndex = 0;
            for (const role of roles) {

                let roleDropdown;
                if (roleIndex === 0) {
                    roleDropdown = $(`#role-dropdown-${elementId}-${unitIndex}-${roleIndex}`);
                    roleDropdown.val(role);
                } else {
                    const addRoleButton = $(`#role-row-${elementId}-${unitIndex}-0 .add-role-button`);
                    addRoleButton.click();

                    roleDropdown = $(`#role-dropdown-${elementId}-${unitIndex}-${roleIndex}`);
                    roleDropdown.val(role);
                }

                roleIndex++;
            }

            unitIndex++;
        }

    } catch (error) {
        console.error('An error occurred while populating the edit subject tab:', error);
    }
}

//Populators
async function populateUnitDropdowns() {
    const allUnitDropdowns = document.querySelectorAll('.unit-select');
    allUnitDropdowns.forEach(dropdown => {
        Array.from(dropdown.options).forEach(option => {
            if (option.value !== '' && !unitsList.includes(option.value)) {
                dropdown.removeChild(option);
            }
        });

        unitsList.forEach(unit => {
            if (!Array.from(dropdown.options).some(option => option.textContent === unit)) {
                const option = document.createElement('option');
                option.textContent = unit;
                dropdown.appendChild(option);
            }
        });
    });
}

async function populateRoleDropdowns() {
    const allRoleDropdowns = document.querySelectorAll('.role-dropdown');

    allRoleDropdowns.forEach(dropdown => {
        Array.from(dropdown.options).forEach(option => {
            if (option.value !== '' && !rolesList.includes(option.value)) {
                dropdown.removeChild(option);
            }
        });
        rolesList.forEach(role => {
            if (!Array.from(dropdown.options).some(option => option.textContent === role)) {
                const option = document.createElement('option');
                option.textContent = role;
                dropdown.appendChild(option);
            }
        });
    });
}

function editUnitDropdowns(oldUnitName, newUnitName) {
    const unitDropdowns = document.querySelectorAll('.unit-select');
    unitDropdowns.forEach(dropdown => {
        Array.from(dropdown.options).forEach(option => {
            if (option.textContent === oldUnitName) {
                option.textContent = newUnitName;
            }
        });
    });
}

function editRoleDropdowns(oldRoleName, newRoleName) {
    const roleDropdowns = document.querySelectorAll('.role-dropdown');
    roleDropdowns.forEach(dropdown => {
        Array.from(dropdown.options).forEach(option => {
            if (option.textContent === oldRoleName) {
                option.textContent = newRoleName;
            }
        });
    });
}



function populateEditUnitTab(tabId) {
    const elementId = tabId.split('-')[1];
    const currentName = getUnitRoleName(elementId);
    const container = $('ui-area[data-belongs-to-tab="' + tabId + '"]');
    container.empty();
  
    const unitColumn = $('<div>', { class: 'roles-column' });

    const columnHeader = $('<div>', { class: 'column-header' });
    const columnCaption = $('<div>', { class: 'column-caption' }).text('Unit Name:');
    columnHeader.append(columnCaption);
    unitColumn.append(columnHeader);
  
    const inputContainer = $('<div>', {
      class: 'roles-input-container',
      style: 'display: flex; margin: 5px 0;'
    });
  
    const inputField = $('<input>', {
      type: 'text',
      id: 'editNameInput',
      value: currentName,
      placeholder: 'Enter new unit name',
      style: 'flex: 1; margin-right: 5px; padding: 5px;'
    });
  
    const saveButton = $('<button>', {
      text: 'Save',
      class: 'confirm-button',
      style: 'padding: 5px 10px;',
      click: async function () {
        const newName = $('#editNameInput').val();
        if (newName === currentName) {
            closeTab(tabId);
          return;
        }
  
        const url = '/edit/unit';
        const params = {
          old_name: currentName,
          new_name: newName
        };
  
        const result = await editXML(url, params);
  
        if (result.success) {
          await updateSVG();
          editUnitDropdowns(currentName, newName);
          closeTab(tabId);
        } else {
          alert(`Error updating unit: ${result.error}`);
        }
      }
    });
  
    inputContainer.append(inputField, saveButton);
    unitColumn.append(inputContainer);
    container.append(unitColumn);
  }
  

  function populateEditRoleTab(tabId) {
    const elementId = tabId.split('-')[1];
    const currentName = getUnitRoleName(elementId);
    const container = $('ui-area[data-belongs-to-tab="' + tabId + '"]');
    container.empty();
  
    const rolesColumn = $('<div>', { class: 'roles-column' });
  
    const columnHeader = $('<div>', { class: 'column-header' });
    const columnCaption = $('<div>', { class: 'column-caption' }).text('Role Name:');
    columnHeader.append(columnCaption);
    rolesColumn.append(columnHeader);
  
    const inputContainer = $('<div>', {
      class: 'roles-input-container',
      style: 'display: flex; margin: 5px 0;'
    });
  
    const inputField = $('<input>', {
      type: 'text',
      id: 'editNameInput',
      value: currentName,
      placeholder: 'Enter new role name',
      style: 'flex: 1; margin-right: 5px; padding: 5px;'
    });
  
    const saveButton = $('<button>', {
      text: 'Save',
      class: 'confirm-button',
      style: 'padding: 5px 10px;',
      click: async function () {
        const newName = $('#editNameInput').val();
        if (newName === currentName) {
          alert('Role already exists!');
          return;
        }
        const url = '/edit/role';
        const params = {
          old_name: currentName,
          new_name: newName
        };
        const result = await editXML(url, params);
        if (result.success) {
          await updateSVG();
          editRoleDropdowns(currentName, newName);
          closeTab(tabId);
        } else {
          alert(`Error updating role: ${result.error}`);
        }
      }
    });
  
    inputContainer.append(inputField, saveButton);
    rolesColumn.append(inputContainer);
    container.append(rolesColumn);
  }
  

//Contextmenu
function addContextMenuListeners() {
    const targetElements = document.querySelectorAll('g.role, g.unit, .subject');
    targetElements.forEach(element => {
        element.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            const menu = new CustomMenu(event);
            menu.contextmenu({
                'Actions': [
                    {
                        label: 'Edit',
                        text_icon: '✏️',
                        function_call: () => {
                            const elementId = element.id || 'unknown';
                            //console.log(`Editing element with id ${elementId}`);
                            editElement(element);
                        },
                        params: []
                    },
                    {
                        label: 'Delete',
                        text_icon: '❌',
                        function_call: () => {
                            const elementId = element.id;
                            //console.log(`Deleting element with id ${elementId}`);
                            removeElement(element);
                        },
                        params: []
                    }
                ]
            });
        });
    });
}

//Edit functions

function editElement(element) {
    const elementId = element.id;

    if (element.id && element.id.startsWith('s')) {
        const uniqueid = element.getAttribute('uniqueid');
        const existingTab = document.querySelector(`ui-tab[data-tab='edit-subject-${uniqueid}']`);
        if (!existingTab) {
            var result = uidash_add_tab_active('ui-rest', 'Edit subject', 'edit-subject-' + uniqueid, true, '');
            var insarea = document.querySelector('ui-area[data-belongs-to-tab="edit-subject-' + uniqueid + '"]');
            var initialTabStructure = createInitialTabStructure('edit-subject-' + uniqueid);
            insarea.appendChild(initialTabStructure);
            populateEditSubjectTab('edit-subject-' + uniqueid);

        } else {
            uidash_activate_tab(existingTab);
        }

    }
    else if (element.id.startsWith('r')) {
        var result = uidash_add_tab_active('ui-rest', 'Edit Role', 'edit-' + element.id, true, '');
        populateEditRoleTab('edit-' + element.id);
    }
    else {
        var result = uidash_add_tab_active('ui-rest', 'Edit Unit', 'edit-' + element.id, true, '');
        populateEditUnitTab('edit-' + element.id);
    }

}



async function removeElement(element) {
    if (element.id && element.id.startsWith('s')) {
        const isConfirmed = confirm("Are you sure you want to remove the Subject: \n\n" + getSubjectName(element.id));
        if (isConfirmed) {
            uniqueid = element.getAttribute('uniqueid');
            const params = {
                subject_uid: uniqueid
            };
            url = '/delete/subject'
            const result = await editXML(url, params);
            if (result.success) {
                await updateSVG();
            } else {
                alert(`Error deleting unit: ${result.error}`);
            }
        }
    }
    else if (element.id.startsWith('u')) {
        const subjects = getSubjects(element.id);
        let subjectList = "";
        for (let subject of subjects) {
            subjectList = subjectList + getSubjectName(subject) + "\n";
        }
        if (subjects.length > 0) {
            const isConfirmed = confirm("You are about to remove the unit relation " + getUnitName(element.id) + " from these subjects: \n\n" + subjectList + "\nDo you want to proceed?");
            if (isConfirmed) {
                unitName = getUnitName(element.id);
                const params = {
                    unit_name: unitName
                };
                url = '/delete/unit'
                const result = await editXML(url, params);
                if (result.success) {
                    await updateSVG();
                    await loadUnits();
                    populateUnitDropdowns();
                } else {
                    alert(`Error deleting unit: ${result.error}`);
                }
            }
        } else {
            unitName = getUnitName(element.id);
            const params = {
                unit_name: unitName
            };
            url = '/delete/unit'
            const result = await editXML(url, params);
            if (result.success) {
                await updateSVG();
                await loadUnits();
                populateUnitDropdowns();
            } else {
                alert(`Error deleting unit: ${result.error}`);
            }
        }
    }
    else if (element.id.startsWith('r')) {
        const subjects = getSubjects(element.id);
        let subjectList = "";
        for (let subject of subjects) {
            subjectList = subjectList + getSubjectName(subject) + "\n";
        }

        if (subjects.length > 0) {
            const isConfirmed = confirm("You are about to remove the role relation " + getUnitName(element.id) + " from these subjects: \n\n" + subjectList + "\nDo you want to proceed?");
            if (isConfirmed) {
                roleName = getRoleName(element.id);
                const params = {
                    role_name: roleName
                };
                url = '/delete/role'
                const result = await editXML(url, params);
                if (result.success) {
                    await updateSVG();
                    await loadRoles();
                    populateRoleDropdowns();
                } else {
                    alert(`Error deleting role: ${result.error}`);
                }
            }
        } else {
            roleName = getRoleName(element.id);
            const params = {
                role_name: roleName
            };
            url = '/delete/role'
            const result = await editXML(url, params);
            if (result.success) {
                await updateSVG();
                await loadRoles();
                populateRoleDropdowns();
            } else {
                alert(`Error deleting role: ${result.error}`);
            }
        }
    }
}

async function addUnit() {
    const inputField = document.querySelector('.units-input-container input[type="text"]');
    const unitName = inputField.value.trim();

    if (!unitName) {
        alert('Please enter a valid unit name.');
        return;
    }

    url = '/add/unit';
    const params = {
        entity_name: unitName
    }
    const result = await editXML(url, params);

    if (result.success) {
        inputField.value = '';
        await updateSVG();
        await loadUnits();
        populateUnitDropdowns();
        switchToGraphTab();
        queryBuilder.setupEntityEventListeners();
    } else {
        alert(`Error adding unit: ${result.error}`);
    }
}

async function addRole() {
    const inputField = document.querySelector('.roles-input-container input[type="text"]');
    const roleName = inputField.value.trim();

    if (!roleName) {
        alert('Please enter a valid role name.');
        return;
    }

    url = '/add/role';
    const params = {
        entity_name: roleName
    }
    const result = await editXML(url, params);

    if (result.success) {
        inputField.value = '';
        await updateSVG();
        await loadRoles();
        populateRoleDropdowns();
        switchToGraphTab();
        queryBuilder.setupEntityEventListeners();
    } else {
        alert(`Error adding role: ${result.error}`);
    }
}

async function saveSubject(uniqueId) {
    //console.log("Current SubjectId: "+uniqueId);
    const subjectName = document.querySelector(`#subject-name-input-${uniqueId}`).value;
    const unitRows = document.querySelectorAll(`#unit-roles-container-${uniqueId} .unit-row`);

    if (!unitRows) {
        alert("Error: Subjects must be part of at least one unit!");
        return;
    }

    if (!subjectName || subjectName.trim() === '') {
        alert("Subject Name can't be empty!");
        return;
    }

    const unitRoles = [];
    const unitSelectValues = new Set();

    for (const unitRow of unitRows) {
        const unitSelect = unitRow.querySelector('.unit-select');
        const unit = unitSelect.value;

        if (unit === '' || unit === 'Select Unit') {
            continue;
        }

        if (unitSelectValues.has(unit)) {
            alert(`Duplicate Unit detected: "${unit}"`);
            return;
        }

        unitSelectValues.add(unit);

        const rolesContainer = unitRow.querySelector('.roles-container');
        const roleSelects = rolesContainer.querySelectorAll('.role-dropdown');
        const roles = [];
        const roleSelectValues = new Set();

        for (const select of roleSelects) {
            const role = select.value;
            if (role === '' || role === 'Select Role') {
                continue;
            }

            if (roleSelectValues.has(role)) {
                alert(`Duplicate Entry for "${unit}": "${role}". Roles within a Unit must be unique.`);
                return;
            }

            roleSelectValues.add(role);
            roles.push(role);
        }

        if (roles.length > 0) {
            unitRoles.push({ unit, roles });
        }
    }

    if (unitRoles.length === 0) {
        alert("Error: Subjects must be part of at least one unit!");
        return;
    }

    const params = {
        subject_uid: uniqueId,
        subject_name: subjectName,
        unit_roles: JSON.stringify(unitRoles)
    };

    const url = '/edit/subject';


    const result = await editXML(url, params);

    if (result.success) {
        await updateSVG();
        if (uniqueId === "default") {
            document.querySelector(`.editor-clear-button-subject-default`).click();
        } else {
            tabId = "edit-subject-" + uniqueId;
            //console.log(tabId);
            closeTab(tabId);
            //console.log("Closing Edit Tab!");
        }
    } else {
        alert(`Error updating subject: ${result.error}`);
    }
}

//Rest Functions

async function editXML(url, params) {
    try {
        const fullUrl = serverurl + url;
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error editing XML: ${errorText}`);
            return { success: false, error: errorText };
        }

        //console.log('XML updated successfully.');
        loadRoles();
        loadUnits();
        return { success: true };
    } catch (error) {
        console.error('An error occurred while editing XML:', error);
        return { success: false, error: error.message };
    }
}

async function updateSVG() {
    try {
        const response = await fetch('http://localhost:4567/update_svg');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        const newGraphContent = doc.querySelector('ui-area#graphcolumn svg');

        if (!newGraphContent) {
            console.error("Could not find SVG in ui-area#graphcolumn");
            return;
        }

        const existingGraphArea = document.querySelector('ui-area#graphcolumn');
        const existingSVG = existingGraphArea?.querySelector('svg');

        if (existingGraphArea && existingSVG) {
            const importedNewGraphContent = document.importNode(newGraphContent, true);
            existingGraphArea.replaceChild(importedNewGraphContent, existingSVG);
        } else {
            console.error("Existing graph area or SVG not found.");
        }

        const newUserListContent = doc.querySelector('body #usercolumn');
        if (!newUserListContent) {
            console.error("Could not find user list in ui-area#usercolumn");
            return;
        }

        const existingUserListArea = document.querySelector('ui-area#usercolumn');
        if (existingUserListArea) {

            const children = [...newUserListContent.children];

            existingUserListArea.replaceChildren(...children);
        } else {
            console.error("Existing user list area not found.");
        }
        queryBuilder.setupEntityEventListeners();

        addContextMenuListeners();
    } catch (error) {
        console.error("Error updating graph content:", error);
    }
}




//Helper functions
function closeTab(tabId) {
    const tabElement = document.querySelector(`ui-tab[data-tab="${tabId}"]`);
    if (tabElement) {
        const closeButton = tabElement.querySelector('ui-close');
        if (closeButton) {
            closeButton.click();
        }
    }
}

function switchToGraphTab() {
    const graphTab = document.querySelector('ui-rest[id="main"] ui-tabbar ui-tab[data-tab="graph"]');

    if (graphTab) {
        graphTab.click();
    } else {
        console.error('Graph tab not found');
    }
}

function getUnitRoleCombinations(subjectId) {
    const unitRoleMap = {};

    $('path.relation').each(function () {
        const classList = $(this).attr('class').split(' ');

        if (classList.includes(subjectId)) {

            const unit = classList.find(c => c.startsWith('u'));
            const role = classList.find(c => c.startsWith('r') && c !== "relation");

            if (unit && role) {
                if (!unitRoleMap[unit]) {
                    unitRoleMap[unit] = [];
                }

                if (!unitRoleMap[unit].includes(role)) {
                    unitRoleMap[unit].push(role);
                }
            }
        }
    });

    return unitRoleMap;
}

async function getRelations(uniqueid) {
    const params = {
        subject_uid: uniqueid
    }
    try {
        const fullUrl = 'http://localhost:4567/get/relations';
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching relations: ${errorText}`);
            return { success: false, error: errorText };
        }

        const relations = await response.json();
        return { success: true, data: relations };
    } catch (error) {
        console.error('An error occurred while fetching the relations', error);
        return { success: false, error: error.message };
    }
}

function getUnitRoleName(id) {
    if (id.startsWith('r')) {
        return getRoleName(id);
    } else {
        return getUnitName(id);
    }
}

function getUnitName(unitId) {
    const unitTextElement = $(`#${unitId}_text`);
    return unitTextElement.length ? unitTextElement.text() : unitId;
}

function getRoleName(roleId) {
    const roleTextElement = $(`#${roleId}_text`);
    return roleTextElement.length ? roleTextElement.text() : roleId;
}

function getSubjectName(subjectId) {
    const subjectTable = $(`#${subjectId}.subject`);
    const nameCell = subjectTable.find('td.labeltext');
    return nameCell.text().trim();
}

function getSubjects(Id) {
    const paths = document.querySelectorAll('path');
    const subjects = [];

    paths.forEach(path => {
        const classList = path.classList;

        if (classList.contains(Id)) {
            classList.forEach(className => {
                if (className.startsWith('s') && !subjects.includes(className)) {
                    subjects.push(className);
                }
            });
        }
    });

    return subjects;
}


$(document).ready(async function () {
    await Promise.all([loadUnits(), loadRoles()]);
    loadAddSubjectTab();
    populateUnitDropdowns();
    populateRoleDropdowns();
    addContextMenuListeners();
});

document.addEventListener('DOMContentLoaded', () => {
    const cancelButton = document.getElementById('cancel-subject-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', cancelSubject);
    }
});