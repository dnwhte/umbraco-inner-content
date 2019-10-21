using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using System.Web.Http.ModelBinding;
using Newtonsoft.Json.Linq;
using Our.Umbraco.InnerContent.Helpers;
using Our.Umbraco.InnerContent.Web.WebApi.Filters;
using Umbraco.Core;
using Umbraco.Core.Dictionary;
using Umbraco.Core.Models;
using Umbraco.Core.Services;
using Umbraco.Web.Editors;
using Umbraco.Web.Models.ContentEditing;
using Umbraco.Web.Mvc;
using Notification = Umbraco.Web.Models.ContentEditing.Notification;

namespace Our.Umbraco.InnerContent.Web.Controllers
{
    [PluginController("InnerContent")]
    public class InnerContentApiController : UmbracoAuthorizedJsonController
    {
        [HttpGet]
        public IEnumerable<object> GetAllContentTypes(bool includeContainerPaths = false)
        {
            return Services.ContentTypeService.GetAllContentTypes()
                .OrderBy(x => x.Name)
                .Select(x => new
                {
                    id = x.Id,
                    guid = x.Key,
                    name = UmbracoDictionaryTranslate(x.Name),
                    alias = x.Alias,
                    icon = string.IsNullOrWhiteSpace(x.Icon) || x.Icon == ".sprTreeFolder" ? "icon-folder" : x.Icon,
                    tabs = x.CompositionPropertyGroups.Select(y => y.Name).Distinct(),
                    containerPath = includeContainerPaths ? GetContainerPath(x) : ""
                });
        }

        [HttpGet]
        public IEnumerable<object> GetContentTypesByGuid([ModelBinder] Guid[] guids)
        {
            var contentTypes = Services.ContentTypeService.GetAllContentTypes(guids).OrderBy(x => Array.IndexOf(guids, x.Key)).ToList();
            var blueprints = Services.ContentService.GetBlueprintsForContentTypes(contentTypes.Select(x => x.Id).ToArray()).ToArray();

            // NOTE: Using an anonymous class, as the `ContentTypeBasic` type is heavier than what we need (for our requirements)
            return contentTypes.Select(ct => new
            {
                name = UmbracoDictionaryTranslate(ct.Name),
                description = ct.Description,
                guid = ct.Key,
                key = ct.Key,
                icon = string.IsNullOrWhiteSpace(ct.Icon) || ct.Icon == ".sprTreeFolder" ? "icon-document" : ct.Icon,
                blueprints = blueprints.Where(bp => bp.ContentTypeId == ct.Id).ToDictionary(bp => bp.Id, bp => bp.Name)
            });
        }

        [HttpGet]
        public IEnumerable<object> GetContentTypesByAlias([ModelBinder] string[] aliases)
        {
            return Services.ContentTypeService.GetAllContentTypes()
                .Where(x => aliases == null || aliases.Contains(x.Alias))
                .OrderBy(x => x.SortOrder)
                .Select(x => new
                {
                    id = x.Id,
                    guid = x.Key,
                    name = UmbracoDictionaryTranslate(x.Name),
                    alias = x.Alias,
                    icon = string.IsNullOrWhiteSpace(x.Icon) || x.Icon == ".sprTreeFolder" ? "icon-folder" : x.Icon,
                    tabs = x.CompositionPropertyGroups.Select(y => y.Name).Distinct()
                });
        }

        [HttpGet]
        public IDictionary<string, string> GetContentTypeIconsByGuid([ModelBinder] Guid[] guids)
        {
            return Services.ContentTypeService.GetAllContentTypes()
                .Where(x => guids.Contains(x.Key))
                .ToDictionary(
                    x => x.Key.ToString(),
                    x => string.IsNullOrWhiteSpace(x.Icon) || x.Icon == ".sprTreeFolder" ? "icon-folder" : x.Icon);
        }

        [HttpGet]
        [UseInternalActionFilter("Umbraco.Web.WebApi.Filters.OutgoingEditorModelEventAttribute", onActionExecuted: true)]
        public ContentItemDisplay GetContentTypeScaffoldByGuid(Guid guid)
        {
            var contentType = Services.ContentTypeService.GetContentType(guid);
            return new ContentController().GetEmpty(contentType.Alias, -20);
        }

        [HttpGet]
        [UseInternalActionFilter("Umbraco.Web.WebApi.Filters.OutgoingEditorModelEventAttribute", onActionExecuted: true)]
        public ContentItemDisplay GetContentTypeScaffoldByBlueprintId(int blueprintId)
        {
            return new ContentController().GetEmpty(blueprintId, -20);
        }

        [HttpPost]
        public SimpleNotificationModel CreateBlueprintFromContent([FromBody] JObject item, int userId = 0)
        {
            var blueprint = InnerContentHelper.ConvertInnerContentToBlueprint(item, userId);

            Services.ContentService.SaveBlueprint(blueprint, userId);

            return new SimpleNotificationModel(new Notification(
                Services.TextService.Localize("blueprints/createdBlueprintHeading"),
                Services.TextService.Localize("blueprints/createdBlueprintMessage", new[] { blueprint.Name }),
                global::Umbraco.Web.UI.SpeechBubbleIcon.Success));
        }

        // Umbraco core's `localizedTextService.UmbracoDictionaryTranslate` is internal. Until it's made public, we have to roll our own.
        // https://github.com/umbraco/Umbraco-CMS/blob/release-7.7.0/src/Umbraco.Core/Services/LocalizedTextServiceExtensions.cs#L76
        private string UmbracoDictionaryTranslate(string text)
        {
            if (text == null)
            {
                return null;
            }

            if (text.StartsWith("#") == false)
            {
                return text;
            }

            text = text.Substring(1);

            if (_cultureDictionary == null)
            {
                _cultureDictionary = CultureDictionaryFactoryResolver.Current.Factory.CreateDictionary();
            }

            return _cultureDictionary[text].IfNullOrWhiteSpace(text);
        }

        private string GetContainerPath(IContentType ct)
        {
            EntityContainer[] containers = Services.ContentTypeService.GetContentTypeContainers(ct)?.ToArray();
            return $"/{(containers != null && containers.Any() ? $"{string.Join("/", containers.Select(c => c.Name))}/" : null)}";
        }

        private static ICultureDictionary _cultureDictionary;
    }
}