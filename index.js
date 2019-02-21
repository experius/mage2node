#!/usr/bin/env node
const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const table = require('console.table');

const wget = require('node-wget');
const extract = require('extract-zip');
const path = require('path');
const del = require('delete');

const Client = require('node-rest-client').Client;
const client = new Client();
const mage2genUrl = 'https://mage2gen.com';


const init = () => {
    console.log(
        chalk.magenta(
            figlet.textSync("Mage2node", {
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
};

const generalQuestions = () => {
    const questions = [
        {
            name: "PACKAGE_NAME",
            type: "input",
            message: "Package name:"
        },
        {
            name: "MODULE_NAME",
            type: "input",
            message: "Module name:"
        },
        {
            name: "DESCRIPTION",
            type: "input",
            message: "Description:"
        },
    ];
    return inquirer.prompt(questions);
};

const snippetQuestions = () => {
    const questions = [
        {
            name: "SNIPPET_NAME",
            type: "input",
            message: "Snippet name:",
            default: "component"
        }
    ];
    return inquirer.prompt(questions);
};

const downloadLocationQuestions = () => {
    const questions = [
        {
            name: "DESTINATION_FOLDER",
            type: "input",
            message: "Destination folder:",
            default: "."
        }
    ];
    return inquirer.prompt(questions);
};

const snippetParamsQuestions = (snippet) => {
    return inquirer.prompt(snippet.params);
}

const request = async (path, data = false) => {
    return new Promise(function(resolve, reject) {
        // Do async job
        if (data != false) {
            let args = {
                data: data,
                headers: { "Content-Type": "application/json" }
            };
            client.post(`${mage2genUrl}/api/${path}/`, args, function (data, response) {
                resolve(data)
            });
        } else {
            client.get(`${mage2genUrl}/api/${path}/`, function (data, response) {
                resolve(data)
            });
        }
    });
};

const downloadPackage = (identifier, DESTINATION_FOLDER) => {

    const file_name = `${identifier}.zip`;
    const url = `${mage2genUrl}/download/src/${file_name}`;
    const file = `${DESTINATION_FOLDER}/${file_name}`;

    wget(
        {
            url: url,
            dest: file
        }, function (error) {
            if (error) {
                console.log('--- error:');
                console.log(error);
            } else {
                extract(file, {dir: DESTINATION_FOLDER}, function (err) {
                    if (err) {
                        console.log('--- error:');
                        console.log(err);
                    } else {
                        del([file]);
                        console.log(
                            chalk.bgMagenta.bold(`Done! Successfully downloaded the package.`)
                        );
                    }
                })
            }
        }
    );
};

const run = async () => {
    const args = process.argv;
    // show script introduction
    init();

    // List available Mage2gen Snippets or run generator
    if (args.includes("list")) {
        const snippets = await request('snippets');
        if (snippets) {
            let snippetTable = [];
            for (key in snippets) {
                delete snippets[key]['name'];
                delete snippets[key]['params'];
                delete snippets[key]['extra_params'];
                snippetTable.push(snippets[key])
            }
            console.table(snippetTable);
        }
    } else {
        // ask questions
        let answers = await generalQuestions();
        const { PACKAGE_NAME, MODULE_NAME, DESCRIPTION } = answers;


        answers = await snippetQuestions();
        const { SNIPPET_NAME } = answers;
        const snippet = await request(`snippets/${SNIPPET_NAME}`)

        answers = await snippetParamsQuestions(snippet);
        answers['extra_params'] = {}
        const snippets = {
            [snippet.name]: [answers]
        };

        // create the module
        let data = {
                package_name: PACKAGE_NAME,
                name: MODULE_NAME,
                config: JSON.stringify({
                    package_name: PACKAGE_NAME,
                    module_name: MODULE_NAME,
                    magento_version: 3,
                    license: "no",
                    description: DESCRIPTION,
                    copyright: '',
                    snippets : snippets
                })
        };

        const module = await request('generator', data);

        const identifier = module.id
        console.log(
            chalk.bgMagenta.bold(`The module/package has been generated ${identifier}.`)
        );

        answers = await downloadLocationQuestions();
        const { DESTINATION_FOLDER } = answers;

        downloadPackage(identifier, path.resolve(DESTINATION_FOLDER));

    }

};

run();