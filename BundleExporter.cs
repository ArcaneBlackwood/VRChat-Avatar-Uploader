#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEditor.UIElements;
using UnityEngine.UIElements;
using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using VRC.Core;
using VRC.SDKBase;
using VRC.SDK3.Avatars.Components;
using VRC.SDK3A.Editor;

public class BundleExporter : EditorWindow {
	private List<VRC_AvatarDescriptor> availableAvatars;
	private PopupField<string> avatarPopup;
	private VRC_AvatarDescriptor selectedAvatar;
	private List<string> avatarNames;

	[MenuItem("VRChat SDK/Utilities/Bundle Exporter")]
	public static void ShowWindow() {
			var window = GetWindow<BundleExporter>();
			window.titleContent = new GUIContent("Bundle Exporter");
			window.minSize = new Vector2(300, 150);
			window.Show();
	}

	private void OnEnable() {
		UpdateAvatarList();

		avatarPopup = new PopupField<string>("Select Avatar", avatarNames, 0);
		avatarPopup.RegisterValueChangedCallback(evt => {
				int index = avatarNames.IndexOf(evt.newValue);
				selectedAvatar = availableAvatars[index];
		});

		Button exportButton = new Button(() => ExportBundle()) { text = "Export Bundle" };

		rootVisualElement.Add(avatarPopup);
		rootVisualElement.Add(exportButton);

		if (availableAvatars.Count > 0)
			selectedAvatar = availableAvatars[0];

		EditorApplication.update += OnUpdate;
	}

	private void OnDisable() {
		EditorApplication.update -= OnUpdate;
	}

	private void OnUpdate() {
		UpdateAvatarList();
	}

	private void UpdateAvatarList() {
		var currentAvatars = VRC.Tools.FindSceneObjectsOfTypeAll<VRC_AvatarDescriptor>()
				.Where(av => av != null && av.gameObject.activeInHierarchy).ToList();

		if (!Enumerable.SequenceEqual(availableAvatars, currentAvatars)) {
			availableAvatars = currentAvatars;
			avatarNames = availableAvatars.Select(avatar => FormatAvatarName(availableAvatars, avatar)).ToList();
			if (avatarPopup != null) {
				int currentIndex = availableAvatars.IndexOf(selectedAvatar);
				avatarPopup.choices = avatarNames;
				if (currentIndex >= 0) {
					avatarPopup.index = currentIndex;
				} else if (availableAvatars.Count > 0) {
					selectedAvatar = availableAvatars[0];
					avatarPopup.index = 0;
				} else {
					selectedAvatar = null;
					avatarPopup.index = -1;
				}
				avatarPopup.value = avatarPopup.index >= 0 ? avatarNames[avatarPopup.index] : null;
			}
		}
	}

	private string FormatAvatarName(List<VRC_AvatarDescriptor> options, VRC_AvatarDescriptor avatar) {
		var currIndex = options.FindAll(a => a.name == avatar.name).IndexOf(avatar);
		return currIndex > 0 ? $"{avatar.name} [{currIndex}]" : avatar.name;
	}

	private async void ExportBundle() {
		if (selectedAvatar?.gameObject == null) {
			EditorUtility.DisplayDialog("Error", "No avatar selected.", "OK");
			return;
		}
		IVRCSdkAvatarBuilderApi builder = GetBuilder();
		if (builder == null) {
			EditorUtility.DisplayDialog("Error", "Failed to fetch avatar builder", "OK");
			return;
		}
		if (!APIUser.IsLoggedIn) {
			EditorUtility.DisplayDialog("Error", "Make sure to open the VRC panel and login", "OK");
			return;
		}

		string path = EditorUtility.SaveFilePanel("Save Bundle", "", selectedAvatar.transform.name + "-" + GetPlatformName() + ".vrca", "vrca");
		if (string.IsNullOrEmpty(path)) return;

		Debug.Log("Exporting["+selectedAvatar.transform.name+"]: "+selectedAvatar);
		string result = await builder.Build(selectedAvatar.gameObject);

		if (result != null) {
			File.Move(result, path);
			EditorUtility.DisplayDialog("Success", "Bundle exported successfully!", "OK");
		} else
			EditorUtility.DisplayDialog("Error", "Failed to export the bundle.", "OK");
	}

	private string GetPlatformName() {
#if UNITY_ANDROID
		return "android";
#else
		return "windows";
#endif
	}
	
	public IVRCSdkAvatarBuilderApi GetBuilder() {
		if (VRCSdkControlPanel.window == null)
			VRCSdkControlPanel.window = (VRCSdkControlPanel)EditorWindow.GetWindow(typeof(VRCSdkControlPanel));
		VRCSdkControlPanel.InitAccount();
		IVRCSdkAvatarBuilderApi builder;
		VRCSdkControlPanel.TryGetBuilder<IVRCSdkAvatarBuilderApi>(out builder);
		return builder;
	}
}
#endif
