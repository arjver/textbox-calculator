document.addEventListener('DOMContentLoaded', async () => {
  const varsContainer = document.getElementById('varscontainer')!;
  const addBtn = document.getElementById('addvar')!;
  let vars: Record<string, number> = {};
  const result = await chrome.storage.sync.get('variables');
  if (result.variables) {
    vars = result.variables;
  }
  renderVars();
  addBtn.addEventListener('click', () => {
    addVar('', 0);
  });
  function renderVars() {
    varsContainer.innerHTML = '';
    Object.entries(vars).forEach(([name, value]) => {
      addVarElement(name, value);
    });
    if (Object.keys(vars).length === 0) {
      varsContainer.innerHTML = '<p>No variables defined. Click "Add Variable" to create one.</p>';
    }
  }
  function addVarElement(name: string, value: number) {
    const div = document.createElement('div');
    div.className = 'varitem';
    div.innerHTML = `
      <input type="text" class="varname" value="${name}" placeholder="Variable name">
      <input type="number" class="varvalue" value="${value}" placeholder="Value">
      <button class="delvar">Delete</button>
    `;
    const nameInput = div.querySelector('.varname') as HTMLInputElement;
    const valueInput = div.querySelector('.varvalue') as HTMLInputElement;
    const deleteBtn = div.querySelector('.delvar') as HTMLButtonElement;
    nameInput.addEventListener('change', () => updateVar(name, nameInput.value, value));
    valueInput.addEventListener('change', () => updateVar(nameInput.value, nameInput.value, parseFloat(valueInput.value)));
    deleteBtn.addEventListener('click', () => deleteVar(nameInput.value));
    varsContainer.appendChild(div);
  }
  function addVar(name: string, value: number) {
    if (name && !vars[name]) {
      vars[name] = value;
      saveVars();
      renderVars();
    } else if (!name) {
      addVarElement('', 0);
    }
  }
  function updateVar(oldName: string, newName: string, newValue: number) {
    if (oldName && vars[oldName] !== undefined) {
      delete vars[oldName];
    }
    if (newName && !isNaN(newValue)) {
      vars[newName] = newValue;
      saveVars();
    }
  }
  function deleteVar(name: string) {
    if (vars[name] !== undefined) {
      delete vars[name];
      saveVars();
      renderVars();
    }
  }
  async function saveVars() {
    await chrome.storage.sync.set({ variables: vars });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'variablesUpdated',
        variables: vars
      }).catch(() => { });
    }
  }
});