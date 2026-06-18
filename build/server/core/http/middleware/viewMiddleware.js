import { renderView } from "../../views/view.js";
export function viewMiddleware() {
    return (_request, response, next) => {
        response.view = async (name, data = {}, options = {}) => {
            response.type("html").send(await renderView(name, data, options));
        };
        next();
    };
}
